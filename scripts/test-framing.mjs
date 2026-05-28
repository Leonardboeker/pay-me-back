// scripts/test-framing.mjs
// Tests the "Du bist 1 von N" interpolation matches UI-SPEC §12 verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';

// Helper that mirrors the page template (also defined inline in [token].astro Plan 02).
function buildGroupFraming(n) {
  return `Du bist 1 von ${n}, die mir noch was schulden — ich weiß, ich weiß.`;
}

test('group framing: N=9 (typical case)', () => {
  assert.equal(buildGroupFraming(9),
    'Du bist 1 von 9, die mir noch was schulden — ich weiß, ich weiß.');
});
test('group framing: N=2 (test-debtors live)', () => {
  assert.equal(buildGroupFraming(2),
    'Du bist 1 von 2, die mir noch was schulden — ich weiß, ich weiß.');
});
test('group framing: contains Selbstironie marker', () => {
  assert.ok(buildGroupFraming(8).includes('ich weiß, ich weiß'),
    'Selbstironie marker missing — Phase-1 D-15 + Checker F-03 violated');
});
test('group framing: no forbidden patterns (Tone-Guide compliance)', () => {
  const text = buildGroupFraming(8);
  assert.doesNotMatch(text, /last chance|bitte zahl|jetzt bezahl|endlich|schon wieder/i);
  assert.doesNotMatch(text, /Sie\b|Liebe[r]?\b|Sehr geehrt/i);
  assert.doesNotMatch(text, /!!|!!!/);
});
