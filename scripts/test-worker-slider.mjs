// scripts/test-worker-slider.mjs
// Integration tests against GET /api/slider.
// Requires wrangler dev running OR API_BASE env var pointing at deployed Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8787';

async function isServerUp() {
  try {
    const res = await fetch(`${API_BASE}/api/slider`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok || res.status >= 400;
  } catch {
    return false;
  }
}

const serverUp = await isServerUp();

test('GET /api/slider returns 200 with total_cents number', { skip: !serverUp }, async () => {
  const res = await fetch(`${API_BASE}/api/slider`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.total_cents, 'number');
  assert.ok(body.total_cents >= 0, 'total_cents must be non-negative');
});

test('GET /api/slider returns same value on repeated calls (no side effect)', { skip: !serverUp }, async () => {
  const r1 = await fetch(`${API_BASE}/api/slider`).then((r) => r.json());
  const r2 = await fetch(`${API_BASE}/api/slider`).then((r) => r.json());
  assert.equal(r1.total_cents, r2.total_cents);
});

if (!serverUp) {
  console.log(`[test-worker-slider] Skipped — server not reachable at ${API_BASE}`);
}
