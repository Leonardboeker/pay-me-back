// src/lib/api-client.ts
// Worker API client for [token].astro <script> blocks.
// API_BASE uses PUBLIC_API_BASE env var (Astro exposes PUBLIC_* to client).
// Fallback: dev = http://localhost:8787, prod = same origin (assumes the
// Worker route is mounted on the same domain at /api/*).

export interface ConfirmPayload {
  token: string;
  modality: 'einmalzahlung' | 'raten' | 'aufschub';
  installments?: number;
  startDate?: string;
  reason?: string;
}

export interface ConfirmResult {
  ok: boolean;
  confirmed: boolean;
  modality?: string;
  error?: string;
}

// In Astro <script> blocks, import.meta.env.DEV works at build time.
// Set PUBLIC_API_BASE in .env (http://localhost:8787) and .env.production (https://pay.your-domain.com).
// If PUBLIC_API_BASE is unset in prod the client falls back to same-origin (''), assuming
// the Worker route is mounted at the same host as the static site.
export const API_BASE: string =
  (import.meta.env.PUBLIC_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:8787' : '');

export async function submitConfirm(payload: ConfirmPayload): Promise<ConfirmResult> {
  try {
    const res = await fetch(`${API_BASE}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as ConfirmResult;
    return { ok: res.ok, ...data };
  } catch {
    return {
      ok: false,
      confirmed: false,
      error: 'Netzwerk-Fehler — bitte nochmal versuchen.',
    };
  }
}

// ============================================================================
// Phase 4: Admin API client
// ============================================================================
// Module-scope admin token, set once by the admin page IIFE via initAdminClient().
// Avoids threading the token through every function signature. Set before any
// admin*() call; otherwise calls return { ok: false, status: 401, error: 'Admin token not initialized' }.

export interface AdminListRow {
  token: string;
  name: string;
  amount: number;
  status: 'open' | 'paid' | 'delayed';
  modality: 'einmalzahlung' | 'raten' | 'aufschub' | null;
  confirmedAt: number | null;
  bodyMeta: string | null;
}

export interface AdminListResponse {
  rows: AdminListRow[];
  slider: { currentCents: number; initialCents: number };
  modalityCounts: { einmalzahlung: number; raten: number; aufschub: number; open: number };
  activity: Array<{ token: string; name: string; modality: string; confirmedAt: number }>;
}

let ADMIN_TOKEN: string | null = null;

export function initAdminClient(token: string): void {
  ADMIN_TOKEN = token;
}

function adminHeaders(): HeadersInit | null {
  if (!ADMIN_TOKEN) return null;
  return { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' };
}

export async function adminList(): Promise<
  | { ok: true; data: AdminListResponse; status: number }
  | { ok: false; status: number; error: string }
> {
  const headers = adminHeaders();
  if (!headers) return { ok: false, status: 401, error: 'Admin token not initialized' };
  try {
    const res = await fetch(`${API_BASE}/api/admin/list`, { headers });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as AdminListResponse;
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}

export async function adminMarkPaid(debtorToken: string): Promise<
  | { ok: true; status: number; wasNew?: boolean }
  | { ok: false; status: number; error: string }
> {
  const headers = adminHeaders();
  if (!headers) return { ok: false, status: 401, error: 'Admin token not initialized' };
  try {
    const res = await fetch(`${API_BASE}/api/admin/mark-paid`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: debtorToken }),
    });
    const data = (await res.json()) as { ok?: boolean; wasNew?: boolean; error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true, status: res.status, wasNew: data.wasNew };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}

export async function adminReset(debtorToken: string): Promise<
  | { ok: true; status: number; wasReset?: boolean; restoredCents?: number }
  | { ok: false; status: number; error: string }
> {
  const headers = adminHeaders();
  if (!headers) return { ok: false, status: 401, error: 'Admin token not initialized' };
  try {
    const res = await fetch(`${API_BASE}/api/admin/reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: debtorToken }),
    });
    const data = (await res.json()) as { ok?: boolean; wasReset?: boolean; restoredCents?: number; error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true, status: res.status, wasReset: data.wasReset, restoredCents: data.restoredCents };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}
