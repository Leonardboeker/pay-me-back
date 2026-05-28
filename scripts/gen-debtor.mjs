// scripts/gen-debtor.mjs
import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nanoid } from 'nanoid';

const RESERVED_PATHS = new Set(['admin', 'api', '404', 'favicon', 'robots', 'sitemap']);
const DEBTOR_TOKEN_LENGTH = 16;
const ADMIN_TOKEN_LENGTH = 22;
const DATA_FILE = resolve(process.cwd(), 'data/debtors.json');

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    amount: { type: 'string' },
    backstory: { type: 'string' },
    admin: { type: 'boolean' },
  },
});

if (values.admin) {
  console.log(nanoid(ADMIN_TOKEN_LENGTH));
  process.exit(0);
}

if (!values.name || !values.amount || !values.backstory) {
  console.error('Usage: node scripts/gen-debtor.mjs --name "Max" --amount 50 --backstory "..."');
  console.error('       node scripts/gen-debtor.mjs --admin   (prints a fresh admin token)');
  process.exit(1);
}

const amount = Number(values.amount);
if (!Number.isFinite(amount) || amount <= 0) {
  console.error('FATAL: --amount must be a positive number');
  process.exit(1);
}

let token;
const existing = existsSync(DATA_FILE)
  ? JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  : [];

if (existing.some((d) => d.name === values.name)) {
  console.error(`FATAL: debtor named "${values.name}" already exists. Edit data/debtors.json by hand if you mean to update.`);
  process.exit(1);
}

const existingTokens = new Set(existing.map((d) => d.token));
do {
  token = nanoid(DEBTOR_TOKEN_LENGTH);
} while (RESERVED_PATHS.has(token) || existingTokens.has(token));

const newDebtor = {
  token,
  name: values.name,
  amount,
  backstory: values.backstory,
  createdAt: new Date().toISOString(),
};

writeFileSync(DATA_FILE, JSON.stringify([...existing, newDebtor], null, 2));
console.log(`Added debtor "${values.name}" with token: ${token}`);
const baseUrl = process.env.SITE_BASE_URL || 'https://YOUR-DOMAIN.com';
console.log(`URL: ${baseUrl}/${token}`);
