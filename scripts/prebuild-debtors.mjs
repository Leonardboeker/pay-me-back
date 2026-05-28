// scripts/prebuild-debtors.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(process.cwd(), 'data/debtors.json');

if (existsSync(target)) {
  console.log('[prebuild] data/debtors.json already exists - using local file.');
  process.exit(0);
}

const json = process.env.PAYLEO_DEBTORS_JSON;
if (!json) {
  console.error('[prebuild] FATAL: data/debtors.json missing AND PAYLEO_DEBTORS_JSON env var not set.');
  console.error('[prebuild] In local dev: create data/debtors.json manually.');
  console.error('[prebuild] In CI: set PAYLEO_DEBTORS_JSON in Cloudflare Pages dashboard.');
  process.exit(1);
}

try {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('PAYLEO_DEBTORS_JSON must be a JSON array');
  if (parsed.length === 0) throw new Error('PAYLEO_DEBTORS_JSON is an empty array');
  for (const d of parsed) {
    for (const key of ['token', 'name', 'amount', 'backstory', 'createdAt']) {
      if (!(key in d)) throw new Error(`debtor missing required key: ${key}`);
    }
  }
  writeFileSync(target, JSON.stringify(parsed, null, 2));
  console.log(`[prebuild] Wrote ${parsed.length} debtors to data/debtors.json`);
} catch (err) {
  console.error('[prebuild] FATAL: PAYLEO_DEBTORS_JSON is not valid:', err.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Phase 2: enforce all build-time env vars + validate shapes.
// Per RESEARCH §Q8 + UI-SPEC §13 — hard-fail beats graceful-degrade because
// silently missing PayPal CTA = worst UX bug. CF Pages logs surface failures clearly.
// ─────────────────────────────────────────────────────────────

const REQUIRED_BUILD_ENV = [
  'PAYLEO_PAYPAL_HANDLE',
  'PAYLEO_BANK_HOLDER',
  'PAYLEO_BANK_IBAN',
  'PAYLEO_BANK_BIC',
];

const missing = REQUIRED_BUILD_ENV.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('[prebuild] FATAL: missing required env vars:');
  for (const key of missing) console.error(`  - ${key}`);
  console.error('[prebuild] Set them in CF Pages dashboard (Settings → Environment variables).');
  console.error('[prebuild] For local dev: copy .env.example to .env and fill in values.');
  process.exit(1);
}

// Shape validation — catches typos at build, not at "Mama opens her link".
const iban = process.env.PAYLEO_BANK_IBAN.replace(/\s+/g, '');
if (!/^DE\d{20}$/.test(iban)) {
  console.error(`[prebuild] FATAL: PAYLEO_BANK_IBAN doesn't look like a German IBAN (expected DE + 20 digits, got "${iban}")`);
  process.exit(1);
}
const bic = process.env.PAYLEO_BANK_BIC.trim();
if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) {
  console.error(`[prebuild] FATAL: PAYLEO_BANK_BIC doesn't look like a valid BIC (expected 8 or 11 chars, got "${bic}")`);
  process.exit(1);
}

console.log('[prebuild] Phase-2 env vars OK: PAYPAL_HANDLE + BANK_HOLDER + BANK_IBAN + BANK_BIC all set + valid');
