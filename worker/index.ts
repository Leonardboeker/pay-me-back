// worker/index.ts
// Main Worker fetch handler — 4 routes:
//   POST /api/confirm           idempotent confirm + notify pipeline
//   GET  /api/state?token=X     check if a token has confirmed
//   GET  /api/slider            current total debt cents
//   GET  /api/admin/drain-pending  Phase 4 stub (always 200 {stub:true})
import { PayLeoDurableObject, type Env } from './durable-object';
import { ConfirmSchema, AdminTokenSchema } from './lib/schemas';
import { notifyWithFallback } from './lib/notify-pipeline';
import { validateAdminToken } from './lib/admin-auth';
import { buildEpcQrDataUrl } from './lib/sepa-qr';

export { PayLeoDurableObject };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Content-Type': 'application/json',
};

const DEADLINE_ISO = '2026-07-15T23:59:59+02:00';

function isPostDeadline(): boolean {
  return Date.now() > new Date(DEADLINE_ISO).getTime();
}

// Validate token against PAYLEO_DEBTORS_JSON; returns debtor record or null.
// Returning null does NOT enumerate valid tokens — caller decides 404 vs 200.
function findDebtor(
  token: string,
  env: Env
): { name: string; amount: number } | null {
  try {
    const debtors = JSON.parse(env.PAYLEO_DEBTORS_JSON) as Array<{
      token: string;
      name: string;
      amount: number;
    }>;
    return debtors.find((d) => d.token === token) ?? null;
  } catch {
    return null;
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // CORS preflight — always allowed
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Singleton DO stub — all requests share one DO instance.
    const stub = env.PAYLEO_DO.get(
      env.PAYLEO_DO.idFromName('payleo-singleton')
    );

    // ---- POST /api/confirm ----
    if (pathname === '/api/confirm' && method === 'POST') {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const parsed = ConfirmSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({
            error: 'Invalid request',
            details: parsed.error.flatten(),
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      const { token, modality, installments, startDate, reason, extraCents } =
        parsed.data;

      const debtor = findDebtor(token, env);
      if (!debtor) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      if (isPostDeadline()) {
        return new Response(JSON.stringify({ error: 'Post-deadline' }), {
          status: 410,
          headers: corsHeaders,
        });
      }

      // Phase 8: extraCents (optional gift) only counts for einmalzahlung + raten;
      // for aufschub the debtor is signaling "no transfer right now" so extras are 0.
      const baseAmountCents = Math.round(debtor.amount * 100);
      const giftCents =
        modality === 'aufschub' ? 0 : Math.max(0, extraCents ?? 0);
      const effectiveAmountCents = baseAmountCents + giftCents;

      const sliderBeforeRow = await stub.getSlider(env.PAYLEO_DEBTORS_JSON);
      const sliderBefore = sliderBeforeRow?.total_cents ?? baseAmountCents;

      const { isNew, record } = await stub.confirm(
        token,
        modality,
        JSON.stringify({ installments, startDate, reason, giftCents }),
        effectiveAmountCents
      );

      const sliderAfterRow = await stub.getSlider(env.PAYLEO_DEBTORS_JSON);
      const sliderAfter = sliderAfterRow?.total_cents ?? sliderBefore;

      if (isNew) {
        await notifyWithFallback({
          env,
          doStub: stub,
          name: debtor.name,
          amountCents: effectiveAmountCents,
          modality: modality as 'einmalzahlung' | 'raten' | 'aufschub',
          sliderBefore,
          sliderAfter,
          installments,
          startDate,
          reason,
          giftCents,
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          confirmed: true,
          isNew,
          modality: record.modality,
          confirmedAt: record.confirmed_at,
        }),
        {
          status: isNew ? 201 : 200,
          headers: corsHeaders,
        }
      );
    }

    // ---- GET /api/state?token=X ----
    if (pathname === '/api/state' && method === 'GET') {
      const token = url.searchParams.get('token');
      // Unknown tokens: return 200 + confirmed:false (don't enumerate valid tokens)
      if (!token || !findDebtor(token, env)) {
        return new Response(JSON.stringify({ confirmed: false }), {
          status: 200,
          headers: corsHeaders,
        });
      }
      const state = await stub.getState(token);
      if (!state) {
        return new Response(JSON.stringify({ confirmed: false }), {
          status: 200,
          headers: corsHeaders,
        });
      }
      return new Response(
        JSON.stringify({
          confirmed: true,
          modality: state.modality,
          confirmedAt: state.confirmed_at,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- GET /api/slider ----
    if (pathname === '/api/slider' && method === 'GET') {
      const slider = await stub.getSlider(env.PAYLEO_DEBTORS_JSON);
      return new Response(
        JSON.stringify({ total_cents: slider?.total_cents ?? 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- GET /api/admin/list ----
    // D-07: NO notify-pipeline call here. Admin reads are silent.
    if (pathname === '/api/admin/list' && method === 'GET') {
      const auth = validateAdminToken(req, env);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: auth.status,
          headers: corsHeaders,
        });
      }

      let debtors: Array<{ token: string; name: string; amount: number }>;
      try {
        debtors = JSON.parse(env.PAYLEO_DEBTORS_JSON);
      } catch {
        return new Response(JSON.stringify({ error: 'Bad config' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const confirms = await stub.listAllConfirms();
      const recentActivity = await stub.recentActivity(10);
      const sliderRow = await stub.getSlider(env.PAYLEO_DEBTORS_JSON);
      const confirmsByToken = new Map(confirms.map((c) => [c.token, c]));

      const rows = debtors.map((d) => {
        const c = confirmsByToken.get(d.token);
        return {
          token: d.token,
          name: d.name,
          amount: d.amount,
          status: c ? (c.modality === 'aufschub' ? 'delayed' : 'paid') : 'open',
          modality: c?.modality ?? null,
          confirmedAt: c?.confirmed_at ?? null,
          bodyMeta: c?.body ?? null,
        };
      });

      const modalityCounts = { einmalzahlung: 0, raten: 0, aufschub: 0, open: 0 };
      for (const r of rows) {
        if (r.status === 'open') modalityCounts.open++;
        else if (r.modality && r.modality in modalityCounts) {
          modalityCounts[r.modality as keyof typeof modalityCounts]++;
        }
      }

      const initialTotalCents = debtors.reduce(
        (sum, d) => sum + Math.round(d.amount * 100),
        0
      );

      return new Response(
        JSON.stringify({
          rows,
          slider: {
            currentCents: sliderRow?.total_cents ?? initialTotalCents,
            initialCents: initialTotalCents,
          },
          modalityCounts,
          activity: recentActivity.map((c) => ({
            token: c.token,
            name: debtors.find((d) => d.token === c.token)?.name ?? '(unknown)',
            modality: c.modality,
            confirmedAt: c.confirmed_at,
          })),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- POST /api/admin/mark-paid ----
    // D-07: NO notify-pipeline call here. Admin actions are silent to Leo's own Telegram.
    if (pathname === '/api/admin/mark-paid' && method === 'POST') {
      const auth = validateAdminToken(req, env);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: auth.status,
          headers: corsHeaders,
        });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const parsed = AdminTokenSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const debtor = findDebtor(parsed.data.token, env);
      if (!debtor) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const amountCents = Math.round(debtor.amount * 100);
      const result = await stub.markPaid(parsed.data.token, amountCents);

      return new Response(
        JSON.stringify({
          ok: true,
          wasNew: result.wasNew,
          record: result.record,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- POST /api/admin/reset ----
    // D-07: NO notify-pipeline call here.
    if (pathname === '/api/admin/reset' && method === 'POST') {
      const auth = validateAdminToken(req, env);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: auth.status,
          headers: corsHeaders,
        });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const parsed = AdminTokenSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const debtor = findDebtor(parsed.data.token, env);
      if (!debtor) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const amountCents = Math.round(debtor.amount * 100);
      const result = await stub.reset(parsed.data.token, amountCents);

      return new Response(
        JSON.stringify({
          ok: true,
          wasReset: result.wasReset,
          restoredCents: result.restoredCents,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- GET /api/admin/drain-pending (Phase 3 stub for Phase 4) ----
    if (pathname === '/api/admin/drain-pending' && method === 'GET') {
      return new Response(
        JSON.stringify({ stub: true, message: 'Phase 4 TODO' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- GET /api/leaderboard?token=<x> ----
    // Phase 7 — anonymous leaderboard sorted by confirmedAt ascending.
    // Privacy gate: caller's token must have confirmed AND be in payment modality
    // (einmalzahlung/raten). Aufschub callers get 403. Returns all debtors with
    // rank/characterSlug; unconfirmed debtors appear unranked (pending slots).
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response(JSON.stringify({ error: 'token required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Parse full debtor list (for characterSlug + name resolution)
      let allDebtors: Array<{ token: string; name: string; characterSlug?: string }>;
      try {
        allDebtors = JSON.parse(env.PAYLEO_DEBTORS_JSON);
      } catch {
        return new Response(JSON.stringify({ error: 'config error' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const callerDebtor = allDebtors.find((d) => d.token === token);
      if (!callerDebtor) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Privacy gate: caller must have a payment-modality confirm on file
      const confirms = await stub.leaderboardConfirms();
      const callerConfirm = confirms.find((c) => c.token === token);
      if (!callerConfirm) {
        return new Response(
          JSON.stringify({ error: 'Leaderboard sichtbar nach eigener Zahlung' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Build ranked + pending entries
      const confirmedTokens = new Set(confirms.map((c) => c.token));
      const ranked = confirms.map((c, i) => {
        const d = allDebtors.find((x) => x.token === c.token);
        return {
          rank: i + 1,
          characterSlug: d?.characterSlug ?? 'unknown',
          confirmedAt: c.confirmed_at,
          modality: c.modality,
          isSelf: c.token === token,
        };
      });
      const pending = allDebtors
        .filter((d) => !confirmedTokens.has(d.token))
        .map((d) => ({
          rank: null as number | null,
          characterSlug: d.characterSlug ?? 'unknown',
          confirmedAt: null as number | null,
          modality: null as string | null,
          isSelf: d.token === token, // false here since caller already confirmed
        }));

      return new Response(
        JSON.stringify({
          entries: [...ranked, ...pending],
          totalDebtors: allDebtors.length,
          paidCount: ranked.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
      );
    }

    // ---- GET /api/qr?token=X&extra=Y ----
    // Phase 8 — dynamic SEPA EPC QR: rebuilds the QR with debt + extraCents
    // so the banking-app scan pre-fills the FULL amount (not just the debt).
    // Returns JSON { dataUrl: "data:image/png;base64,..." } for the img src swap.
    if (pathname === '/api/qr' && method === 'GET') {
      const reqToken = url.searchParams.get('token') ?? '';
      const extraParam = parseInt(url.searchParams.get('extra') ?? '0', 10);
      const extraCents = Math.max(0, Math.min(100000, isNaN(extraParam) ? 0 : extraParam));
      const debtor = findDebtor(reqToken, env);
      if (!debtor) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      const effectiveAmountEuros = debtor.amount + extraCents / 100;
      // Purpose mirrors src/lib/purpose.ts — strip non-alphanumeric from first name.
      const firstName = debtor.name.split(' ')[0] ?? debtor.name;
      const safe = firstName.replace(/[^A-Za-z0-9]/g, '');
      const purpose = `PayLeo-${safe}-2026`;
      try {
        const dataUrl = await buildEpcQrDataUrl({
          holder: env.PAYLEO_BANK_HOLDER,
          iban: env.PAYLEO_BANK_IBAN,
          bic: env.PAYLEO_BANK_BIC,
          amount: effectiveAmountEuros,
          purpose,
        });
        return new Response(
          JSON.stringify({
            dataUrl,
            amount: effectiveAmountEuros,
            purpose,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store',
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: 'QR generation failed', detail: String(err) }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // ---- GET /api/leaderboard?token=X ----
    // Phase 7: ranked list of ALL debtors (paid sorted by confirmed_at ASC, then pending).
    // Privacy gate: only returns 200 if the requester has themselves confirmed.
    // No names, no amounts, no timestamps — characterSlug only.
    // Shape: { totalDebtors, paidCount, entries: [{rank|null, characterSlug, isSelf}] }
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const reqToken = url.searchParams.get('token') ?? '';
      let debtors: Array<{ token: string; characterSlug?: string }> = [];
      try {
        debtors = JSON.parse(env.PAYLEO_DEBTORS_JSON);
      } catch {
        return new Response(JSON.stringify({ error: 'Config error' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
      const requester = debtors.find((d) => d.token === reqToken);
      if (!requester) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }
      const confirms = await stub.getConfirmsSorted();
      const requesterConfirmed = confirms.some((c) => c.token === reqToken);
      if (!requesterConfirmed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Build rank lookup: token → rank (1-based, by confirmed_at ASC).
      const rankByToken = new Map<string, number>();
      confirms.forEach((c, idx) => rankByToken.set(c.token, idx + 1));

      // Entries: paid debtors first (sorted by rank), then pending (in PAYLEO_DEBTORS_JSON order).
      const paidEntries = confirms
        .map((c) => {
          const d = debtors.find((x) => x.token === c.token);
          if (!d?.characterSlug) return null;
          return {
            rank: rankByToken.get(c.token) ?? null,
            characterSlug: d.characterSlug,
            isSelf: c.token === reqToken,
          };
        })
        .filter((e): e is { rank: number | null; characterSlug: string; isSelf: boolean } => e !== null);

      const paidTokens = new Set(confirms.map((c) => c.token));
      const pendingEntries = debtors
        .filter((d) => !paidTokens.has(d.token) && d.characterSlug)
        .map((d) => ({
          rank: null,
          characterSlug: d.characterSlug!,
          isSelf: d.token === reqToken,
        }));

      return new Response(
        JSON.stringify({
          totalDebtors: debtors.length,
          paidCount: confirms.length,
          entries: [...paidEntries, ...pendingEntries],
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ---- POST /api/admin/reseed-slider ----
    // One-shot: deletes the slider_state row so the next /api/slider call
    // re-derives total from current PAYLEO_DEBTORS_JSON. Use after rotating
    // the debtor list (e.g., test → real users migration on 2026-05-28).
    // Admin-token gated; D-07 silent (no notify call).
    if (pathname === '/api/admin/reseed-slider' && method === 'POST') {
      const auth = validateAdminToken(req, env);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: auth.status,
          headers: corsHeaders,
        });
      }
      const result = await stub.reseedSlider();
      return new Response(
        JSON.stringify({ ok: true, deletedRow: result.deletedRow }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};
