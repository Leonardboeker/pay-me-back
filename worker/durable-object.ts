// worker/durable-object.ts
// PayLeo Durable Object — SQLite-backed atomic state for slider + confirms + notification queue.
// First-write-wins idempotency via INSERT OR IGNORE + cursor.rowsWritten check.
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  PAYLEO_DO: DurableObjectNamespace;
  PAYLEO_TELEGRAM_BOT_TOKEN: string;
  PAYLEO_TELEGRAM_CHAT_ID: string;
  PAYLEO_RESEND_API_KEY: string;
  PAYLEO_NOTIFY_EMAIL: string;
  PAYLEO_DEBTORS_JSON: string;
  // Phase 4 — admin endpoint auth (X-Admin-Token header value)
  PAYLEO_ADMIN_TOKEN: string;
  // Phase 8 — dynamic SEPA QR generation (debt + extra gift)
  PAYLEO_BANK_HOLDER: string;
  PAYLEO_BANK_IBAN: string;
  PAYLEO_BANK_BIC: string;
}

export interface ConfirmRecord {
  token: string;
  confirmed_at: number;
  modality: string;
  body: string; // JSON-stringified { installments?, startDate?, reason? }
}

export interface SliderState {
  total_cents: number;
  updated_at: number;
}

export interface PendingNotification {
  id: number;
  payload: string;
  attempted_count: number;
  last_error: string | null;
}

export class PayLeoDurableObject extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize schema — idempotent (IF NOT EXISTS), runs on every DO load.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS confirms (
        token         TEXT PRIMARY KEY,
        confirmed_at  INTEGER NOT NULL,
        modality      TEXT NOT NULL,
        body          TEXT NOT NULL DEFAULT '{}'
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS slider_state (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        total_cents INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS pending_notifications (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        payload         TEXT NOT NULL,
        attempted_count INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT
      );
    `);
  }

  // Idempotent confirm. Returns isNew=true if this token had no prior confirm.
  // Only decrements slider for payment modalities (NOT aufschub).
  confirm(
    token: string,
    modality: string,
    body: string,
    amountCents: number
  ): { isNew: boolean; record: ConfirmRecord } {
    const confirmedAt = Date.now();

    // Pre-check existence: cursor.rowsWritten on INSERT OR IGNORE is unreliable
    // on Cloudflare DO SqlStorage without consuming the cursor first. Explicit
    // SELECT-then-INSERT is unambiguous and survives runtime quirks.
    const existing = this.sql
      .exec(`SELECT 1 FROM confirms WHERE token = ? LIMIT 1`, token)
      .toArray();
    const isNew = existing.length === 0;

    if (isNew) {
      this.sql.exec(
        `INSERT INTO confirms (token, confirmed_at, modality, body)
         VALUES (?, ?, ?, ?)`,
        token,
        confirmedAt,
        modality,
        body
      );
    }

    if (isNew && modality !== 'aufschub') {
      // Decrement slider for payment modalities only.
      // ON CONFLICT: subtract amountCents from existing total, clamp at 0.
      this.sql.exec(
        `INSERT INTO slider_state (id, total_cents, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           total_cents = MAX(0, total_cents - ?),
           updated_at = excluded.updated_at`,
        amountCents,
        confirmedAt,
        amountCents
      );
    }

    const record = this.sql
      .exec(`SELECT * FROM confirms WHERE token = ?`, token)
      .one() as unknown as ConfirmRecord;

    return { isNew, record };
  }

  getState(token: string): ConfirmRecord | null {
    const rows = this.sql
      .exec(`SELECT * FROM confirms WHERE token = ?`, token)
      .toArray() as unknown as ConfirmRecord[];
    return rows[0] ?? null;
  }

  // Auto-init from PAYLEO_DEBTORS_JSON sum if no row exists (RESEARCH Open Q1).
  getSlider(
    debtorsJson?: string
  ): { total_cents: number; updated_at: number } | null {
    const rows = this.sql
      .exec(`SELECT total_cents, updated_at FROM slider_state WHERE id = 1`)
      .toArray() as unknown as SliderState[];

    if (rows.length === 0 && debtorsJson) {
      try {
        const debtors = JSON.parse(debtorsJson) as Array<{ amount: number }>;
        const totalCents = debtors.reduce(
          (sum, d) => sum + Math.round(d.amount * 100),
          0
        );
        this.initSlider(totalCents);
        return { total_cents: totalCents, updated_at: Date.now() };
      } catch {
        return null;
      }
    }
    return rows[0] ?? null;
  }

  initSlider(totalCents: number): void {
    this.sql.exec(
      `INSERT OR IGNORE INTO slider_state (id, total_cents, updated_at)
       VALUES (1, ?, ?)`,
      totalCents,
      Date.now()
    );
  }

  // One-shot admin: wipe slider_state so next getSlider() re-derives total
  // from current PAYLEO_DEBTORS_JSON. Use after rotating the debtor list.
  reseedSlider(): { deletedRow: boolean } {
    const before = this.sql
      .exec(`SELECT COUNT(*) AS c FROM slider_state WHERE id = 1`)
      .toArray() as unknown as Array<{ c: number }>;
    this.sql.exec(`DELETE FROM slider_state WHERE id = 1`);
    return { deletedRow: (before[0]?.c ?? 0) > 0 };
  }

  // Phase 7 — Leaderboard: return all confirms sorted by confirmed_at ASC.
  // Caller pairs tokens to characterSlug via PAYLEO_DEBTORS_JSON lookup.
  // Privacy: this returns ALL confirms — caller must gate by requester's own
  // confirm-status before exposing the list.
  getConfirmsSorted(): Array<{ token: string; confirmed_at: number }> {
    return this.sql
      .exec(`SELECT token, confirmed_at FROM confirms ORDER BY confirmed_at ASC`)
      .toArray() as unknown as Array<{ token: string; confirmed_at: number }>;
  }

  queueNotification(payload: string): void {
    this.sql.exec(
      `INSERT INTO pending_notifications (payload, attempted_count)
       VALUES (?, 0)`,
      payload
    );
  }

  drainPending(): PendingNotification[] {
    return this.sql
      .exec(`SELECT * FROM pending_notifications ORDER BY id ASC`)
      .toArray() as unknown as PendingNotification[];
  }

  markNotificationSent(id: number): void {
    this.sql.exec(`DELETE FROM pending_notifications WHERE id = ?`, id);
  }

  markNotificationFailed(id: number, error: string): void {
    this.sql.exec(
      `UPDATE pending_notifications
       SET attempted_count = attempted_count + 1, last_error = ?
       WHERE id = ?`,
      error,
      id
    );
  }

  // ---- Phase 4: Admin overrides ----

  // Admin manually marks a debtor as paid (D-07: no notification fires).
  // Idempotent: second call on same token is no-op (slider not double-decremented).
  // Returns wasNew=true if this insert created the row, false if a confirm already existed.
  markPaid(
    token: string,
    amountCents: number
  ): { wasNew: boolean; record: ConfirmRecord } {
    const confirmedAt = Date.now();
    const existing = this.sql
      .exec(`SELECT * FROM confirms WHERE token = ? LIMIT 1`, token)
      .toArray() as unknown as ConfirmRecord[];

    if (existing.length > 0) {
      return { wasNew: false, record: existing[0] };
    }

    this.sql.exec(
      `INSERT INTO confirms (token, confirmed_at, modality, body)
       VALUES (?, ?, ?, ?)`,
      token,
      confirmedAt,
      'einmalzahlung',
      JSON.stringify({ source: 'admin' })
    );

    // Decrement slider; clamp at 0 (matches confirm() pattern).
    this.sql.exec(
      `INSERT INTO slider_state (id, total_cents, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         total_cents = MAX(0, total_cents - ?),
         updated_at = excluded.updated_at`,
      amountCents,
      confirmedAt,
      amountCents
    );

    const record = this.sql
      .exec(`SELECT * FROM confirms WHERE token = ?`, token)
      .one() as unknown as ConfirmRecord;
    return { wasNew: true, record };
  }

  // Admin resets a debtor — deletes the confirm row + restores slider if prior modality
  // was a payment. Aufschub never decremented the slider so we don't increment on reset.
  // Safe under DO serialization — concurrent /api/confirm cannot interleave (per RESEARCH Pitfall 2).
  reset(
    token: string,
    amountCents: number
  ): { wasReset: boolean; restoredCents: number } {
    const existing = this.sql
      .exec(`SELECT modality FROM confirms WHERE token = ? LIMIT 1`, token)
      .toArray() as Array<{ modality: string }>;

    if (existing.length === 0) {
      return { wasReset: false, restoredCents: 0 };
    }

    const wasPaymentModality = existing[0].modality !== 'aufschub';

    this.sql.exec(`DELETE FROM confirms WHERE token = ?`, token);

    if (wasPaymentModality) {
      this.sql.exec(
        `INSERT INTO slider_state (id, total_cents, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           total_cents = total_cents + ?,
           updated_at = excluded.updated_at`,
        amountCents,
        Date.now(),
        amountCents
      );
      return { wasReset: true, restoredCents: amountCents };
    }

    return { wasReset: true, restoredCents: 0 };
  }

  // Used by GET /api/admin/list — Worker joins these rows against PAYLEO_DEBTORS_JSON in JS.
  listAllConfirms(): ConfirmRecord[] {
    return this.sql
      .exec(`SELECT * FROM confirms ORDER BY confirmed_at DESC`)
      .toArray() as unknown as ConfirmRecord[];
  }

  // Used by GET /api/admin/list — last N confirmations for the Activity Log widget (D-05).
  recentActivity(limit: number): ConfirmRecord[] {
    return this.sql
      .exec(`SELECT * FROM confirms ORDER BY confirmed_at DESC LIMIT ?`, limit)
      .toArray() as unknown as ConfirmRecord[];
  }

  // Phase 7 — Leaderboard data. Returns confirms filtered to payment modalities
  // (einmalzahlung + raten; aufschub excluded per user decision), sorted by
  // confirmedAt ascending so the FIRST to pay is rank 1.
  leaderboardConfirms(): Array<{ token: string; confirmed_at: number; modality: string }> {
    return this.sql
      .exec(
        `SELECT token, confirmed_at, modality FROM confirms
         WHERE modality != 'aufschub'
         ORDER BY confirmed_at ASC`
      )
      .toArray() as unknown as Array<{ token: string; confirmed_at: number; modality: string }>;
  }
}
