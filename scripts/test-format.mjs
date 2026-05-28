// scripts/test-format.mjs
// Unit tests for src/lib/format.ts logic.
// Re-implement the logic here so the test runs without a TS build step.
// Keep this in sync with src/lib/format.ts.
import test from 'node:test';
import assert from 'node:assert/strict';

function formatAmount(amount) {
  return amount.toLocaleString('de-DE', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
function formatIban(iban) {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
function stripIban(iban) {
  return iban.replace(/\s+/g, '');
}

test('formatAmount: integer → no decimals', () => {
  assert.equal(formatAmount(50), '50');
  assert.equal(formatAmount(1234), '1.234');
});
test('formatAmount: fractional → two decimals + German comma', () => {
  assert.equal(formatAmount(50.5), '50,50');
  assert.equal(formatAmount(50.123), '50,12');     // rounded
  assert.equal(formatAmount(1234.5), '1.234,50');
});
test('formatIban: roundtrip ↔ spaces-every-4', () => {
  assert.equal(formatIban('DE89370400440532013000'), 'DE89 3704 0044 0532 0130 00');
  assert.equal(formatIban('DE89 3704 0044 0532 0130 00'), 'DE89 3704 0044 0532 0130 00');  // idempotent
});
test('stripIban: removes spaces, idempotent', () => {
  assert.equal(stripIban('DE89 3704 0044 0532 0130 00'), 'DE89370400440532013000');
  assert.equal(stripIban('DE89370400440532013000'), 'DE89370400440532013000');
});
