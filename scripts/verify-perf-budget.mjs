// scripts/verify-perf-budget.mjs
// Checks asset sizes against UI-SPEC §15 budgets after npm run build.
// Exits non-zero if any budget exceeded.
import { statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');

// Budget caps — Phase 3.1+5 reality (D-05)
// Phase 2 placeholders (80/30/10 KB) were pre-Stitch design system.
// Updated after sprite compression + Barcelona Pixel Dawn token expansion + admin dashboard CSS.
const BUDGETS = {
  sprites: { cap: 2048 * 1024, label: 'Sprite-sheets sum (dist/sprites/**/*.png)' },
  css:     {   cap: 80 * 1024, label: 'CSS total (dist/_astro/*.css)' },
  js:      {   cap: 15 * 1024, label: 'JS total (dist/_astro/*.js)' },
};

// Recursive walker — current dist/sprites/ has a stitch/ subdirectory after build.
// Skips rollback artifacts (.orig.bak, .png.bak, *-jpg-bak.png) that get copied
// from public/ by Astro but are not production assets.
function dirSize(dir, ext) {
  try {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      // Skip backup/rollback artifacts that travel via public/ copy
      if (name.endsWith('.orig.bak') || name.endsWith('.png.bak') || name.includes('-jpg-bak.')) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        total += dirSize(full, ext);
      } else if (name.endsWith(ext)) {
        total += statSync(full).size;
      }
    }
    return total;
  } catch { return 0; }
}

let failed = 0;

// Sprites live in dist/sprites/ (copied from public/ by Astro)
const spritesSize = dirSize(join(distDir, 'sprites'), '.png');
if (spritesSize > BUDGETS.sprites.cap) {
  console.error(`FAIL: ${BUDGETS.sprites.label} = ${spritesSize} bytes (cap ${BUDGETS.sprites.cap})`);
  failed++;
} else {
  console.log(`OK: ${BUDGETS.sprites.label} = ${spritesSize} bytes`);
}

// CSS — Tailwind v4 purged output in dist/_astro/
const cssSize = dirSize(join(distDir, '_astro'), '.css');
if (cssSize > BUDGETS.css.cap) {
  console.error(`FAIL: ${BUDGETS.css.label} = ${cssSize} bytes (cap ${BUDGETS.css.cap})`);
  failed++;
} else {
  console.log(`OK: ${BUDGETS.css.label} = ${cssSize} bytes`);
}

// JS — CopyButton client island + countdown re-calc
const jsSize = dirSize(join(distDir, '_astro'), '.js');
if (jsSize > BUDGETS.js.cap) {
  console.error(`FAIL: ${BUDGETS.js.label} = ${jsSize} bytes (cap ${BUDGETS.js.cap})`);
  failed++;
} else {
  console.log(`OK: ${BUDGETS.js.label} = ${jsSize} bytes`);
}

process.exit(failed > 0 ? 1 : 0);
