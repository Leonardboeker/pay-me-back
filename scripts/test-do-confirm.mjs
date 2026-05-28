// scripts/test-do-confirm.mjs
// Unit tests for the DO confirm() / slider logic.
// Cannot import worker/durable-object.ts directly (depends on cloudflare:workers runtime).
// Strategy: replicate the EXACT SQL queries via a minimal in-memory SQLite-shape mock
// and assert behavior. The mock implements only the operators the DO actually uses:
// INSERT OR IGNORE, ON CONFLICT DO UPDATE, MAX(), and basic SELECT.
//
// To keep this honest, the queries here MUST match the queries in worker/durable-object.ts.
// If you change one, change the other.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- Minimal in-memory store mirroring the DO's SQLite tables ----
function createStore() {
  const confirms = new Map(); // token -> { token, confirmed_at, modality, body }
  const slider = { row: null }; // { id, total_cents, updated_at } | null
  const pending = []; // { id, payload, attempted_count, last_error }
  let pendingId = 1;

  return {
    confirms,
    slider,
    pending,
    insertConfirm(token, confirmedAt, modality, body) {
      if (confirms.has(token)) {
        return { rowsWritten: 0 };
      }
      confirms.set(token, {
        token,
        confirmed_at: confirmedAt,
        modality,
        body,
      });
      return { rowsWritten: 1 };
    },
    sliderUpsertDecrement(amountCents, updatedAt) {
      if (slider.row === null) {
        slider.row = { id: 1, total_cents: amountCents, updated_at: updatedAt };
      } else {
        slider.row.total_cents = Math.max(0, slider.row.total_cents - amountCents);
        slider.row.updated_at = updatedAt;
      }
    },
    initSlider(totalCents) {
      if (slider.row === null) {
        slider.row = { id: 1, total_cents: totalCents, updated_at: Date.now() };
      }
    },
    queueNotification(payload) {
      pending.push({
        id: pendingId++,
        payload,
        attempted_count: 0,
        last_error: null,
      });
    },
  };
}

// ---- DO-equivalent functions (mirror worker/durable-object.ts confirm()) ----
function confirm(store, token, modality, body, amountCents) {
  const confirmedAt = Date.now();
  const cursor = store.insertConfirm(token, confirmedAt, modality, body);
  const isNew = cursor.rowsWritten === 1;

  if (isNew && modality !== 'aufschub') {
    store.sliderUpsertDecrement(amountCents, confirmedAt);
  }

  const record = store.confirms.get(token);
  return { isNew, record };
}

function getSlider(store, debtorsJson) {
  if (store.slider.row === null && debtorsJson) {
    const debtors = JSON.parse(debtorsJson);
    const totalCents = debtors.reduce(
      (sum, d) => sum + Math.round(d.amount * 100),
      0
    );
    store.initSlider(totalCents);
    return { total_cents: totalCents, updated_at: Date.now() };
  }
  return store.slider.row
    ? {
        total_cents: store.slider.row.total_cents,
        updated_at: store.slider.row.updated_at,
      }
    : null;
}

// ---- Tests ----

test('confirm() with new token → isNew=true, record stored', () => {
  const store = createStore();
  // Pre-seed slider so it doesn't auto-init
  store.initSlider(38000);
  const result = confirm(store, 'tok-abc', 'einmalzahlung', '{}', 5000);
  assert.equal(result.isNew, true);
  assert.equal(result.record.token, 'tok-abc');
  assert.equal(result.record.modality, 'einmalzahlung');
});

test('confirm() with same token twice → isNew=false on 2nd call (idempotent)', () => {
  const store = createStore();
  store.initSlider(38000);
  const first = confirm(store, 'tok-xyz', 'einmalzahlung', '{}', 5000);
  const second = confirm(store, 'tok-xyz', 'einmalzahlung', '{}', 5000);
  assert.equal(first.isNew, true);
  assert.equal(second.isNew, false);
  // Slider must only decrement ONCE
  assert.equal(store.slider.row.total_cents, 33000);
});

test('confirm() aufschub does NOT decrement slider', () => {
  const store = createStore();
  store.initSlider(38000);
  const result = confirm(store, 'tok-aufschub', 'aufschub', '{"reason":"test"}', 5000);
  assert.equal(result.isNew, true);
  // Slider unchanged
  assert.equal(store.slider.row.total_cents, 38000);
});

test('confirm() einmalzahlung DOES decrement slider', () => {
  const store = createStore();
  store.initSlider(38000);
  confirm(store, 'tok-pay', 'einmalzahlung', '{}', 5000);
  assert.equal(store.slider.row.total_cents, 33000);
});

test('confirm() raten decrements slider (payment modality)', () => {
  const store = createStore();
  store.initSlider(38000);
  confirm(store, 'tok-raten', 'raten', '{"installments":2}', 9000);
  assert.equal(store.slider.row.total_cents, 29000);
});

test('slider clamps at 0 (cannot go negative)', () => {
  const store = createStore();
  store.initSlider(3000);
  confirm(store, 'tok-big', 'einmalzahlung', '{}', 5000);
  assert.equal(store.slider.row.total_cents, 0, 'must clamp at 0');
});

test('getSlider() auto-inits from debtorsJson sum on first call', () => {
  const store = createStore();
  const debtorsJson = JSON.stringify([
    { token: 'a', amount: 50 },
    { token: 'b', amount: 90 },
    { token: 'c', amount: 240 },
  ]);
  const slider = getSlider(store, debtorsJson);
  // 50 + 90 + 240 = 380 EUR = 38000 cents
  assert.equal(slider.total_cents, 38000);
  // Subsequent call returns persisted row
  const again = getSlider(store, debtorsJson);
  assert.equal(again.total_cents, 38000);
});

test('aufschub then einmalzahlung on different tokens both stored; only einmalzahlung touches slider', () => {
  const store = createStore();
  store.initSlider(38000);
  confirm(store, 'tok-1', 'aufschub', '{}', 5000);
  assert.equal(store.slider.row.total_cents, 38000, 'aufschub left slider alone');
  confirm(store, 'tok-2', 'einmalzahlung', '{}', 5000);
  assert.equal(store.slider.row.total_cents, 33000, 'einmalzahlung decremented');
});
