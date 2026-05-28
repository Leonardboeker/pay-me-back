// scripts/test-do-admin.mjs
// Unit tests for the DO admin methods (markPaid, reset, listAllConfirms, recentActivity).
// Cannot import worker/durable-object.ts directly (depends on cloudflare:workers runtime).
// Strategy: mirror the EXACT SQL queries via a minimal in-memory mock — same pattern as
// scripts/test-do-confirm.mjs. If queries here drift from worker/durable-object.ts the
// behavior assertion no longer maps to production code.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- Minimal in-memory store mirroring the DO's SQLite tables ----
function createStore() {
  const confirms = new Map(); // token -> { token, confirmed_at, modality, body }
  const slider = { row: null }; // { id, total_cents, updated_at } | null

  return {
    confirms,
    slider,
    selectConfirm(token) {
      // Mirrors: SELECT * FROM confirms WHERE token = ? LIMIT 1
      const row = confirms.get(token);
      return row ? [row] : [];
    },
    insertConfirm(token, confirmedAt, modality, body) {
      confirms.set(token, {
        token,
        confirmed_at: confirmedAt,
        modality,
        body,
      });
    },
    deleteConfirm(token) {
      // Mirrors: DELETE FROM confirms WHERE token = ?
      confirms.delete(token);
    },
    sliderUpsertDecrement(amountCents, updatedAt) {
      // Mirrors: INSERT ... ON CONFLICT(id) DO UPDATE SET total_cents = MAX(0, total_cents - ?)
      if (slider.row === null) {
        slider.row = { id: 1, total_cents: amountCents, updated_at: updatedAt };
      } else {
        slider.row.total_cents = Math.max(0, slider.row.total_cents - amountCents);
        slider.row.updated_at = updatedAt;
      }
    },
    sliderUpsertIncrement(amountCents, updatedAt) {
      // Mirrors reset()'s INSERT ... ON CONFLICT(id) DO UPDATE SET total_cents = total_cents + ?
      // NO clamp on increment (per RESEARCH Pitfall 3 — math proves no drift possible).
      if (slider.row === null) {
        slider.row = { id: 1, total_cents: amountCents, updated_at: updatedAt };
      } else {
        slider.row.total_cents = slider.row.total_cents + amountCents;
        slider.row.updated_at = updatedAt;
      }
    },
    initSlider(totalCents) {
      if (slider.row === null) {
        slider.row = { id: 1, total_cents: totalCents, updated_at: Date.now() };
      }
    },
    listAllConfirms() {
      // Mirrors: SELECT * FROM confirms ORDER BY confirmed_at DESC
      return Array.from(confirms.values()).sort(
        (a, b) => b.confirmed_at - a.confirmed_at
      );
    },
    recentActivity(limit) {
      // Mirrors: SELECT * FROM confirms ORDER BY confirmed_at DESC LIMIT ?
      return Array.from(confirms.values())
        .sort((a, b) => b.confirmed_at - a.confirmed_at)
        .slice(0, limit);
    },
  };
}

// ---- DO-equivalent functions (mirror worker/durable-object.ts admin methods) ----

function markPaid(store, token, amountCents) {
  const confirmedAt = Date.now();
  const existing = store.selectConfirm(token);
  if (existing.length > 0) {
    return { wasNew: false, record: existing[0] };
  }
  store.insertConfirm(
    token,
    confirmedAt,
    'einmalzahlung',
    JSON.stringify({ source: 'admin' })
  );
  store.sliderUpsertDecrement(amountCents, confirmedAt);
  const record = store.confirms.get(token);
  return { wasNew: true, record };
}

function reset(store, token, amountCents) {
  const existing = store.selectConfirm(token);
  if (existing.length === 0) {
    return { wasReset: false, restoredCents: 0 };
  }
  const wasPaymentModality = existing[0].modality !== 'aufschub';
  store.deleteConfirm(token);
  if (wasPaymentModality) {
    store.sliderUpsertIncrement(amountCents, Date.now());
    return { wasReset: true, restoredCents: amountCents };
  }
  return { wasReset: true, restoredCents: 0 };
}

// Mirror confirm() from test-do-confirm.mjs so reset-of-aufschub tests can pre-seed via
// the same code path the production code uses.
function confirm(store, token, modality, body, amountCents) {
  const confirmedAt = Date.now();
  const existing = store.selectConfirm(token);
  if (existing.length > 0) {
    return { isNew: false, record: existing[0] };
  }
  store.insertConfirm(token, confirmedAt, modality, body);
  if (modality !== 'aufschub') {
    store.sliderUpsertDecrement(amountCents, confirmedAt);
  }
  return { isNew: true, record: store.confirms.get(token) };
}

// Tiny helper so insertion-order tests have unambiguous timestamps even when
// markPaid/confirm are called in the same millisecond. Mutates row directly.
function setConfirmedAt(store, token, timestamp) {
  const row = store.confirms.get(token);
  if (row) row.confirmed_at = timestamp;
}

// ---- Tests ----

test('Test 1: markPaid on empty store → wasNew=true, slider decremented', () => {
  const store = createStore();
  store.initSlider(38000);
  const result = markPaid(store, 'tok-new', 5000);
  assert.equal(result.wasNew, true);
  assert.equal(result.record.token, 'tok-new');
  assert.equal(result.record.modality, 'einmalzahlung');
  // Body must be {source:'admin'} marker
  const bodyJson = JSON.parse(result.record.body);
  assert.equal(bodyJson.source, 'admin');
  // Slider decremented by 5000
  assert.equal(store.slider.row.total_cents, 33000);
});

test('Test 2: markPaid twice on same token → 2nd call wasNew=false, slider only decremented once', () => {
  const store = createStore();
  store.initSlider(38000);
  const first = markPaid(store, 'tok-x', 5000);
  const second = markPaid(store, 'tok-x', 5000);
  assert.equal(first.wasNew, true);
  assert.equal(second.wasNew, false);
  // Slider only decremented ONCE (38000 - 5000 = 33000)
  assert.equal(store.slider.row.total_cents, 33000);
});

test('Test 3: markPaid after prior self-confirm of same token → wasNew=false, slider unchanged', () => {
  const store = createStore();
  store.initSlider(38000);
  // Self-confirm first (einmalzahlung decrements by 5000)
  confirm(store, 'tok-self', 'einmalzahlung', '{}', 5000);
  assert.equal(store.slider.row.total_cents, 33000);
  // Now admin marks paid — should be no-op
  const result = markPaid(store, 'tok-self', 5000);
  assert.equal(result.wasNew, false);
  // Slider unchanged (still 33000, NOT 28000)
  assert.equal(store.slider.row.total_cents, 33000);
  // Existing record preserved (modality stays 'einmalzahlung' from self-confirm)
  assert.equal(result.record.modality, 'einmalzahlung');
});

test('Test 4: reset after prior markPaid → wasReset=true, restoredCents=amount, slider restored, row deleted', () => {
  const store = createStore();
  store.initSlider(38000);
  markPaid(store, 'tok-paid', 5000);
  assert.equal(store.slider.row.total_cents, 33000);
  const result = reset(store, 'tok-paid', 5000);
  assert.equal(result.wasReset, true);
  assert.equal(result.restoredCents, 5000);
  // Slider restored: 33000 + 5000 = 38000
  assert.equal(store.slider.row.total_cents, 38000);
  // Row deleted
  assert.equal(store.confirms.has('tok-paid'), false);
});

test('Test 5: reset after prior aufschub confirm → wasReset=true, restoredCents=0, slider UNCHANGED, row deleted', () => {
  const store = createStore();
  store.initSlider(38000);
  // Aufschub never decrements slider
  confirm(store, 'tok-aufschub', 'aufschub', '{"reason":"test"}', 5000);
  assert.equal(store.slider.row.total_cents, 38000);
  const result = reset(store, 'tok-aufschub', 5000);
  assert.equal(result.wasReset, true);
  assert.equal(result.restoredCents, 0);
  // Slider stays at 38000 (no increment because aufschub never decremented)
  assert.equal(store.slider.row.total_cents, 38000);
  // Row deleted
  assert.equal(store.confirms.has('tok-aufschub'), false);
});

test('Test 6: reset of unconfirmed token → wasReset=false, restoredCents=0, slider unchanged (no-op)', () => {
  const store = createStore();
  store.initSlider(38000);
  const result = reset(store, 'tok-unknown', 5000);
  assert.equal(result.wasReset, false);
  assert.equal(result.restoredCents, 0);
  assert.equal(store.slider.row.total_cents, 38000);
});

test('Test 7: markPaid → reset → markPaid → reset preserves slider math (final = initial)', () => {
  const store = createStore();
  store.initSlider(38000);
  const initial = store.slider.row.total_cents;

  markPaid(store, 'tok-cycle', 5000);
  assert.equal(store.slider.row.total_cents, 33000);

  reset(store, 'tok-cycle', 5000);
  assert.equal(store.slider.row.total_cents, 38000);

  markPaid(store, 'tok-cycle', 5000);
  assert.equal(store.slider.row.total_cents, 33000);

  reset(store, 'tok-cycle', 5000);
  assert.equal(store.slider.row.total_cents, initial, 'final state must match initial');
});

test('Test 8: listAllConfirms returns rows ordered by confirmed_at DESC', () => {
  const store = createStore();
  store.initSlider(38000);
  // Insert 3 with explicit timestamps so order is deterministic
  markPaid(store, 'tok-1', 1000);
  setConfirmedAt(store, 'tok-1', 1_000_000);
  markPaid(store, 'tok-2', 1000);
  setConfirmedAt(store, 'tok-2', 2_000_000);
  markPaid(store, 'tok-3', 1000);
  setConfirmedAt(store, 'tok-3', 3_000_000);

  const rows = store.listAllConfirms();
  assert.equal(rows.length, 3);
  // Order: tok-3 (3M) first, then tok-2 (2M), then tok-1 (1M)
  assert.equal(rows[0].token, 'tok-3');
  assert.equal(rows[1].token, 'tok-2');
  assert.equal(rows[2].token, 'tok-1');
});

test('Test 9: recentActivity(2) after 4 confirms returns 2 most-recent rows', () => {
  const store = createStore();
  store.initSlider(38000);
  markPaid(store, 'tok-a', 1000);
  setConfirmedAt(store, 'tok-a', 1_000_000);
  markPaid(store, 'tok-b', 1000);
  setConfirmedAt(store, 'tok-b', 2_000_000);
  markPaid(store, 'tok-c', 1000);
  setConfirmedAt(store, 'tok-c', 3_000_000);
  markPaid(store, 'tok-d', 1000);
  setConfirmedAt(store, 'tok-d', 4_000_000);

  const rows = store.recentActivity(2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].token, 'tok-d');
  assert.equal(rows[1].token, 'tok-c');
});

test('Test 10: markPaid clamps slider at 0 (cannot go negative)', () => {
  const store = createStore();
  // Slider starts at 3000, markPaid amount 5000 → clamps at 0
  store.initSlider(3000);
  markPaid(store, 'tok-big', 5000);
  assert.equal(store.slider.row.total_cents, 0, 'must clamp at 0');
});
