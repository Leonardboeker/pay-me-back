// scripts/smoke-test.mjs
// End-to-end pre-send checklist — runs curl-style checks against a deployed
// pay-me-back instance in <30 s with no browser.
//
// Usage:
//   SMOKE_BASE=https://pay.example.com \
//   SMOKE_TOKENS="abc123:Alice,def456:Bob" \
//   npm run smoke
//
//   # Local dev
//   SMOKE_BASE=http://localhost:4321 SMOKE_TOKENS="..." npm run smoke
//
//   # Include admin route check
//   SMOKE_ADMIN_TOKEN=xxxxx npm run smoke
//
// Env vars:
//   SMOKE_BASE          Base URL of the deployed site (no trailing slash). Required.
//   SMOKE_TOKENS        Comma-separated list of "<token>:<expectedName>" pairs.
//                       Each pair gets a GET + HTML-microcopy + state-API check.
//                       Required for the (a)/(b)/(d) check groups; otherwise skipped.
//   SMOKE_ADMIN_TOKEN   Optional — when set, also verifies /admin/<token>/ returns 200.
//
// Exit 0 if all checks pass, 1 if any fail. Skipped checks do not count as failures.

const BASE = process.env.SMOKE_BASE || '';
const ADMIN_TOKEN = process.env.SMOKE_ADMIN_TOKEN || '';
const RAW_TOKENS = process.env.SMOKE_TOKENS || '';

if (!BASE) {
  console.error('[smoke] SMOKE_BASE env var is required (e.g. https://pay.example.com)');
  process.exit(2);
}

// Parse "token1:Name1,token2:Name2" → [{token, expectedName}, ...]
const DEBTORS = RAW_TOKENS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pair) => {
    const [token, expectedName] = pair.split(':');
    return { token: (token || '').trim(), expectedName: (expectedName || '').trim() };
  })
  .filter((d) => d.token);

let pass = 0;
let fail = 0;
let skipped = 0;

function ok(label) { console.log(`  ✓ ${label}`); pass++; }
function bad(label, why) { console.error(`  ✗ ${label} — ${why}`); fail++; }
function skip(label, why) { console.log(`  ~ ${label} (skipped: ${why})`); skipped++; }

async function check(label, fn) {
  try {
    const result = await fn();
    if (result === true) ok(label);
    else if (result && typeof result === 'object' && result.skip) skip(label, result.skip);
    else bad(label, typeof result === 'string' ? result : 'returned non-true');
  } catch (e) {
    bad(label, e.message);
  }
}

async function fetchText(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  return { status: res.status, text, length: text.length };
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text), text };
  } catch {
    return { status: res.status, json: null, text };
  }
}

const startedAt = Date.now();

console.log(`\n[smoke] BASE=${BASE}`);
console.log(`[smoke] Debtor checks: ${DEBTORS.length > 0 ? `${DEBTORS.length} token(s)` : 'SKIPPED (set SMOKE_TOKENS="token:Name,token:Name")'}`);
console.log(`[smoke] Admin checks: ${ADMIN_TOKEN ? 'ON' : 'SKIPPED (SMOKE_ADMIN_TOKEN unset)'}`);
console.log('');

// (a) Debtor pages: 200 + >=30 KB + contains debtor name
console.log('(a) Debtor pages:');
if (DEBTORS.length === 0) {
  await check('GET /<token>/ -> 200', async () => ({ skip: 'no SMOKE_TOKENS' }));
} else {
  for (const { token, expectedName } of DEBTORS) {
    await check(`GET /${token}/ -> 200, >=30 KB${expectedName ? `, contains "${expectedName}"` : ''}`, async () => {
      const { status, text, length } = await fetchText(`${BASE}/${token}/`);
      if (status !== 200) return `status ${status}`;
      if (length < 30 * 1024) return `body ${length} bytes (need >=30 KB)`;
      if (expectedName && !text.includes(expectedName)) return `body missing "${expectedName}"`;
      return true;
    });
  }
}

// (b) HTML contains required microcopy + EPC-QR data URL
console.log('\n(b) Debtor HTML microcopy + QR:');
if (DEBTORS.length === 0) {
  await check('debtor HTML smoke', async () => ({ skip: 'no SMOKE_TOKENS' }));
} else {
  for (const { token } of DEBTORS) {
    await check(`/${token}/ has Reference + PayPal + QR data URL`, async () => {
      const { status, text } = await fetchText(`${BASE}/${token}/`);
      if (status !== 200) return `status ${status}`;
      if (!/Reference/i.test(text)) return 'no "Reference" label (IBAN block)';
      if (!/(PayPal)/i.test(text)) return 'no PayPal CTA';
      if (!/data:image\/png;base64/.test(text)) return 'no inline EPC-QR data URL';
      return true;
    });
  }
}

// (c) GET /api/slider returns valid JSON with total_cents
console.log('\n(c) /api/slider:');
await check('GET /api/slider -> 200, valid JSON with total_cents number', async () => {
  const { status, json } = await fetchJson(`${BASE}/api/slider`);
  if (status !== 200) return `status ${status}`;
  if (!json) return 'not valid JSON';
  if (typeof json.total_cents !== 'number') return `total_cents not number (got ${typeof json.total_cents})`;
  return true;
});

// (d) GET /api/state?token=<x> returns valid JSON per debtor
console.log('\n(d) /api/state?token=<token>:');
if (DEBTORS.length === 0) {
  await check('GET /api/state?token=...', async () => ({ skip: 'no SMOKE_TOKENS' }));
} else {
  for (const { token } of DEBTORS) {
    await check(`GET /api/state?token=${token} -> 200, valid JSON with confirmed boolean`, async () => {
      const { status, json } = await fetchJson(`${BASE}/api/state?token=${token}`);
      if (status !== 200) return `status ${status}`;
      if (!json) return 'not valid JSON';
      if (typeof json.confirmed !== 'boolean') return `confirmed not boolean (got ${typeof json.confirmed})`;
      return true;
    });
  }
}

// (e) Admin enumeration: valid -> 200, invalid -> 404
console.log('\n(e) Admin route enumeration:');
if (ADMIN_TOKEN) {
  await check(`GET /admin/${ADMIN_TOKEN.slice(0,4)}.../ -> 200`, async () => {
    const { status } = await fetchText(`${BASE}/admin/${ADMIN_TOKEN}/`);
    if (status !== 200) return `status ${status}`;
    return true;
  });
} else {
  await check('GET /admin/<token>/ -> 200', async () => ({ skip: 'no SMOKE_ADMIN_TOKEN' }));
}
await check('GET /admin/this-is-fake-token/ -> 404 (not enumerable)', async () => {
  const { status } = await fetchText(`${BASE}/admin/this-is-fake-token/`);
  if (status !== 404) return `status ${status} (expected 404)`;
  return true;
});

// Summary
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
console.log('\n' + '─'.repeat(60));
console.log(`[smoke] ${pass} passed, ${fail} failed, ${skipped} skipped (${elapsed}s)`);
if (fail > 0) {
  console.error('[smoke] FAIL — checklist not green, do NOT send debtor links yet.');
  process.exit(1);
} else {
  console.log('[smoke] PASS — pre-send checklist green.');
  console.log('         REMINDER: also run manual checks:');
  console.log('         - real Telegram/Resend notification on a single test confirm');
  console.log('         - SEPA-QR scans in at least one real EU banking app (DKB/Sparkasse/N26/Revolut/Comdirect)');
}
