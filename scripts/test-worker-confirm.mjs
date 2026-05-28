// scripts/test-worker-confirm.mjs
// Integration tests against POST /api/confirm.
// Requires wrangler dev running OR API_BASE env var pointing at deployed Worker.
// Skips gracefully if server unreachable (so CI/lint runs don't fail).
//
// Run: npm run worker:dev   (in another terminal)
//      API_TEST_TOKEN=<real-token-from-debtors.json> node --test scripts/test-worker-confirm.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8787';
const TEST_TOKEN = process.env.API_TEST_TOKEN; // must be a real token in PAYLEO_DEBTORS_JSON

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

test('POST /api/confirm without TEST_TOKEN — skipped', { skip: !TEST_TOKEN || !serverUp }, async () => {
  // Reset state by using a unique fresh token isn't possible (token must match debtor list).
  // Instead: test that first call returns 201, second returns 200 (idempotency by definition
  // means we need to use a token that may have been confirmed before — accept 201 OR 200 on first try,
  // then require 200 on second).
  const res1 = await fetch(`${API_BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TEST_TOKEN, modality: 'einmalzahlung' }),
  });
  assert.ok([200, 201].includes(res1.status), `First call status should be 200/201, got ${res1.status}`);
  const body1 = await res1.json();
  assert.equal(body1.confirmed, true);

  const res2 = await fetch(`${API_BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TEST_TOKEN, modality: 'einmalzahlung' }),
  });
  assert.equal(res2.status, 200, 'Repeated call must return 200 (idempotent)');
  const body2 = await res2.json();
  assert.equal(body2.isNew, false, 'Repeated call must report isNew=false');
});

test('POST /api/confirm with unknown token → 404', { skip: !serverUp }, async () => {
  const res = await fetch(`${API_BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'unknown-token-not-in-list-1234',
      modality: 'einmalzahlung',
    }),
  });
  assert.equal(res.status, 404);
});

test('POST /api/confirm with missing modality → 400', { skip: !serverUp }, async () => {
  const res = await fetch(`${API_BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'any-token-string-1234567890ab' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/confirm with invalid JSON → 400', { skip: !serverUp }, async () => {
  const res = await fetch(`${API_BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
  assert.equal(res.status, 400);
});

if (!serverUp) {
  console.log(`[test-worker-confirm] Skipped — server not reachable at ${API_BASE}`);
  console.log('[test-worker-confirm] Run "npm run worker:dev" in another terminal first.');
}
