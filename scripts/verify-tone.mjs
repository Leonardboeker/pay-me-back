// scripts/verify-tone.mjs
// Build-time tone-linter: greps rendered dist/**/*.html for forbidden patterns
// AND verifies that all debtor pages contain required Phase-3 microcopy.
// Per UI-SPEC §12.1 + Phase-3 D-17. Exits non-zero if any check fails.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');

// Forbidden patterns from UI-SPEC §12.1 + docs/TONE.md DON'T
const FORBIDDEN = [
  { pattern: /last chance|bitte zahl|jetzt bezahl|endlich|schon wieder/i, reason: "pressure-language (TONE.md DON'T #2 / #4)" },
  { pattern: /Sie\b|Liebe[r]?\b|Sehr geehrt/i, reason: "formal-Sie address (TONE.md DON'T #1)" },
  { pattern: /!!|!!!/, reason: "alarm-punctuation (TONE.md DON'T #3)" },
  { pattern: /⚠️|🚨/, reason: "alarm-emoji (TONE.md DON'T #3)" },
  // Phase-3 additions (D-17)
  { pattern: /zahlen oder sterben|bezahl endlich|letzte warnung/i, reason: "pressure-language Phase-3 (TONE.md DON'T #2)" },
];

// REQUIRED patterns — every debtor page (token-routed HTML) must contain these
// strings post-build. Phase-3 locked microcopy from CONTEXT §specifics.
// Locale: English (post-locale-switch).
const REQUIRED_IN_DEBTOR_PAGES = [
  { pattern: /Are you sure\?/, reason: "confirm-modal microcopy (CONTEXT §specifics LOCKED)" },
  { pattern: /Thanks,/, reason: "success-state heading (CONTEXT §specifics LOCKED)" },
  { pattern: /What works for you\?/, reason: "modality-selector heading (CONTEXT §specifics LOCKED)" },
];

// Collect all HTML files recursively
function walkHtml(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) files.push(...walkHtml(join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(join(dir, e.name));
  }
  return files;
}

// Debtor-page heuristic: HTML files under dist/ whose parent dir is the token slug
// (i.e. NOT index, 404, admin, etc). A debtor page contains the personalized greeting
// and the modality selector. We detect debtor pages by presence of "kurze Sache" (h1
// pattern from [token].astro). Admin and post-deadline pages are excluded.
function isDebtorPage(file, content) {
  const name = basename(file);
  // Skip top-level non-token pages
  if (name === '404.html') return false;
  if (file.includes(`${join('dist', 'admin')}`)) return false;
  // The /post-deadline-test/ route has different copy; skip if no h1-greeting found.
  // [token].astro renders an h1 with "quick thing" (sr-only) only on the pre-deadline path.
  if (!/quick thing/.test(content)) return false;
  return true;
}

let failed = 0;
let htmlFiles;
try {
  htmlFiles = walkHtml(distDir);
} catch {
  console.error('[verify-tone] dist/ not found — run npm run build first');
  process.exit(1);
}

// Pass 1: forbidden patterns — check ALL html files
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf-8');
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(content)) {
      console.error(`FAIL [tone-forbidden]: ${file} matches forbidden pattern "${pattern}" — ${reason}`);
      failed++;
    }
  }
}

// Pass 2: required patterns — check only DEBTOR pages
const debtorPages = [];
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf-8');
  if (isDebtorPage(file, content)) {
    debtorPages.push({ file, content });
  }
}

if (debtorPages.length === 0) {
  console.error('[verify-tone] No debtor pages found in dist/ — required-pattern check skipped (may indicate build problem)');
} else {
  for (const { file, content } of debtorPages) {
    for (const { pattern, reason } of REQUIRED_IN_DEBTOR_PAGES) {
      if (!pattern.test(content)) {
        console.error(`FAIL [tone-required]: ${file} missing required pattern "${pattern}" — ${reason}`);
        failed++;
      }
    }
  }
}

if (failed === 0) {
  console.log(
    `[verify-tone] PASS — ${htmlFiles.length} HTML files checked (${debtorPages.length} debtor pages), no tone violations.`
  );
} else {
  console.error(`[verify-tone] FAIL — ${failed} violation(s). Fix copy before deploy.`);
  process.exit(1);
}
