// scripts/test-paypal-url.mjs
// Unit tests for buildPaypalUrl() — mirrors src/lib/format.ts.
import test from 'node:test';
import assert from 'node:assert/strict';

function buildPaypalUrl(handle, amount) {
  const amountStr = amount % 1 === 0 ? String(Math.trunc(amount)) : amount.toFixed(2);
  return `https://paypal.me/${handle}/${amountStr}EUR`;
}

test('integer amount → no decimal', () => {
  assert.equal(buildPaypalUrl('examplehandle', 50), 'https://paypal.me/examplehandle/50EUR');
  assert.equal(buildPaypalUrl('examplehandle', 100), 'https://paypal.me/examplehandle/100EUR');
});
test('fractional amount → dot decimal (PayPal.me URL convention)', () => {
  assert.equal(buildPaypalUrl('examplehandle', 50.5), 'https://paypal.me/examplehandle/50.50EUR');
  assert.equal(buildPaypalUrl('examplehandle', 12.34), 'https://paypal.me/examplehandle/12.34EUR');
});
