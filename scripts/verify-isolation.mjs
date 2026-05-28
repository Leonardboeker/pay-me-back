// scripts/verify-isolation.mjs
// Verifies cross-debtor isolation (DEBT-04, D-12) after astro build.
// For each debtor: dist/<token>/index.html must contain only that debtor's name
// and none of any other debtor's name.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const dataFile = resolve(process.cwd(), 'data/debtors.json');

if (!existsSync(distDir)) {
  console.error('FATAL: dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}
if (!existsSync(dataFile)) {
  console.error('FATAL: data/debtors.json does not exist.');
  process.exit(1);
}

const list = JSON.parse(readFileSync(dataFile, 'utf8'));
if (!Array.isArray(list) || list.length === 0) {
  console.error('FATAL: data/debtors.json is empty or not an array.');
  process.exit(1);
}

let failed = 0;
for (const me of list) {
  const file = join(distDir, me.token, 'index.html');
  if (!existsSync(file)) {
    console.error('MISSING:', file);
    failed++;
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (!html.includes(me.name)) {
    console.error('LEAK:', file, '- missing own name', me.name);
    failed++;
  }
  for (const other of list) {
    if (other.token === me.token) continue;
    if (html.includes(other.name)) {
      console.error('LEAK:', file, '- contains other debtor name:', other.name);
      failed++;
    }
  }
}

if (failed > 0) {
  console.error('FAILED isolation checks:', failed);
  process.exit(1);
}
console.log('Isolation verified for', list.length, 'debtors.');
