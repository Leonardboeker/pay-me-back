// scripts/test-deadline.mjs
// Smoke test for the deadline boundary. Self-contained: re-implements the
// helper inline so the test does not depend on a build step.
// The constants and logic MUST match src/lib/deadline.ts exactly.
const DEADLINE_ISO = '2026-07-03T23:59:59+02:00';
const DEADLINE_MS = new Date(DEADLINE_ISO).getTime();
const isPostDeadline = (now) => now.getTime() > DEADLINE_MS;

const cases = [
  { input: new Date('2026-07-03T23:59:58+02:00'), expected: false, label: 'one second before' },
  { input: new Date('2026-07-04T00:00:00+02:00'), expected: true,  label: 'one second after' },
  { input: new Date('2026-07-03T22:59:59+01:00'), expected: false, label: 'same instant, different TZ format' },
  { input: new Date('2026-08-01T00:00:00Z'),      expected: true,  label: 'a month after, UTC' },
];

let failed = 0;
for (const c of cases) {
  const actual = isPostDeadline(c.input);
  if (actual !== c.expected) {
    console.error(`FAIL: ${c.label} - expected ${c.expected}, got ${actual}`);
    failed++;
  } else {
    console.log(`OK: ${c.label}`);
  }
}
console.log(`Deadline: ${DEADLINE_ISO} = ${DEADLINE_MS} ms`);
process.exit(failed > 0 ? 1 : 0);
