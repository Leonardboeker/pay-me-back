// scripts/test-worker-admin.mjs
// Integration tests for the 3 admin routes (/api/admin/list, /api/admin/mark-paid, /api/admin/reset).
// Requires wrangler dev running OR API_BASE env var pointing at deployed Worker.
// Skips gracefully if server unreachable or required env vars missing.
//
// Run: npm run worker:dev   (in another terminal)
//      ADMIN_TEST_TOKEN=<PAYLEO_ADMIN_TOKEN> API_TEST_TOKEN=<real-debtor-token> \
//        node --test scripts/test-worker-admin.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8787';
const ADMIN_TOKEN = process.env.ADMIN_TEST_TOKEN; // must equal PAYLEO_ADMIN_TOKEN on the Worker
const DEBTOR_TOKEN = process.env.API_TEST_TOKEN; // must be a real token in PAYLEO_DEBTORS_JSON

async function isServerUp() {
  try {
    const res = await fetch(`${API_BASE}/api/slider`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok || res.status >= 400; // any HTTP response means server is up
  } catch {
    return false;
  }
}

const serverUp = await isServerUp();
const skipNoServer = { skip: !serverUp };
const skipNoAdmin = { skip: !serverUp || !ADMIN_TOKEN };
const skipNoFull = { skip: !serverUp || !ADMIN_TOKEN || !DEBTOR_TOKEN };

// ---- Tests ----

test('Test 1: GET /api/admin/list WITHOUT X-Admin-Token → 401', skipNoServer, async () => {
  const res = await fetch(`${API_BASE}/api/admin/list`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'Unauthorized');
});

test('Test 2: GET /api/admin/list with WRONG X-Admin-Token → 403', skipNoServer, async () => {
  const res = await fetch(`${API_BASE}/api/admin/list`, {
    headers: { 'X-Admin-Token': 'wrong-token-deliberately-12345' },
  });
  assert.equal(res.status, 403);
});

test('Test 3: GET /api/admin/list with valid X-Admin-Token → 200 + correct shape', skipNoAdmin, async () => {
  const res = await fetch(`${API_BASE}/api/admin/list`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows), 'rows must be an array');
  assert.ok(body.slider && typeof body.slider.currentCents === 'number', 'slider.currentCents required');
  assert.ok(typeof body.slider.initialCents === 'number', 'slider.initialCents required');
  assert.ok(body.modalityCounts, 'modalityCounts required');
  assert.ok(Array.isArray(body.activity), 'activity must be an array');
});

test('Test 4: GET /api/admin/list rows.length matches debtor count', skipNoAdmin, async () => {
  const res = await fetch(`${API_BASE}/api/admin/list`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  const body = await res.json();
  // Each row corresponds to one debtor in PAYLEO_DEBTORS_JSON.
  // Sanity: at least one debtor exists, all rows have token/name/amount.
  assert.ok(body.rows.length >= 1, 'must have at least 1 debtor');
  for (const row of body.rows) {
    assert.ok(row.token, 'row.token required');
    assert.ok(row.name, 'row.name required');
    assert.ok(typeof row.amount === 'number', 'row.amount required');
    assert.ok(['open', 'paid', 'delayed'].includes(row.status), `row.status invalid: ${row.status}`);
  }
});

test('Test 5: POST /api/admin/mark-paid with valid token + valid debtor token → 200 + correct shape', skipNoFull, async () => {
  const res = await fetch(`${API_BASE}/api/admin/mark-paid`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: DEBTOR_TOKEN }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(typeof body.wasNew === 'boolean', 'wasNew must be boolean');
  // record present when wasNew=true; when wasNew=false record is the existing row.
  assert.ok(body.record && body.record.token === DEBTOR_TOKEN, 'record must reference the token');
});

test('Test 6: POST /api/admin/mark-paid with valid admin + UNKNOWN debtor token → 404', skipNoAdmin, async () => {
  const res = await fetch(`${API_BASE}/api/admin/mark-paid`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'unknown-debtor-token-xyz-9999' }),
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'Not found');
});

test('Test 7: POST /api/admin/mark-paid with missing body.token → 400', skipNoAdmin, async () => {
  const res = await fetch(`${API_BASE}/api/admin/mark-paid`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('Test 8: POST /api/admin/reset with valid admin + valid debtor → 200 + correct shape', skipNoFull, async () => {
  const res = await fetch(`${API_BASE}/api/admin/reset`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: DEBTOR_TOKEN }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(typeof body.wasReset === 'boolean', 'wasReset must be boolean');
  assert.ok(typeof body.restoredCents === 'number', 'restoredCents must be number');
});

test('Test 9: POST /api/admin/reset with INVALID JSON body → 400', skipNoAdmin, async () => {
  const res = await fetch(`${API_BASE}/api/admin/reset`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: 'not-json-deliberately',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid JSON');
});

test('Test 10: POST /api/admin/mark-paid with no X-Admin-Token header → 401', skipNoServer, async () => {
  const res = await fetch(`${API_BASE}/api/admin/mark-paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'whatever-1234567890ab' }),
  });
  assert.equal(res.status, 401);
});

if (!serverUp) {
  console.log(`[test-worker-admin] Skipped — server not reachable at ${API_BASE}`);
  console.log('[test-worker-admin] Run "npm run worker:dev" in another terminal first.');
} else if (!ADMIN_TOKEN) {
  console.log('[test-worker-admin] Skipped admin-token tests — set ADMIN_TEST_TOKEN to run.');
}
