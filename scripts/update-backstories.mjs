// scripts/update-backstories.mjs
// One-shot: translate backstories + emit ASCII-safe compact JSON (escapes non-ASCII
// chars as \uXXXX so PowerShell `type` preserves them when piped to wrangler).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync('data/debtors.json', 'utf8'));

// Per Leo 2026-05-28: 4 backstories back to German (Leo, Felix B, Ben, Talitsch),
// rest stay English. Personal-relationship recipients prefer DE; uni-group recipients EN.
const en = {
  'leo':      'Studienzeit-Klassiker — du hattest dir damals was geliehen.',
  'felix-b':  'Düsseldorf-Abend — Constantin wird Papa, du warst auf der Feier dabei.',
  'ben':      'Amsterdam-Trip zu deinem Geburtstag (Oktober 2024) — Auto, Sprit, Parking, Essen sind über meine Karte gelaufen. 100€ ziehe ich als Geschenk ab.',
  'felix-t':  'Switzerland trip with Onur, Elias & Jenny — the car actually cost 530€ but I am only charging the agreed 350€ (I cover the rest). Plus gas 100€ and a speeding ticket 100€. Your 5-way split.',
  'elias':    'Two things: 1) Switzerland trip with Onur, Felix T & Jenny — car actually 530€ but only charging the agreed 350€ (I cover the rest), plus gas 100€ and a speeding ticket 100€ (5-way split 110€). 2) Uni study group materials — wood 164.99€, aluminum extrusion 20€, screws 5€ (5-way split 38€).',
  'onur':     'Two things: 1) Switzerland trip with Felix T, Elias & Jenny — car actually 530€ but only charging the agreed 350€ (I cover the rest), plus gas 100€ and a speeding ticket 100€ (5-way split 110€). 2) Bar night where we planned the studio project — 7€.',
  'jenny':    'Switzerland excursion with Onur, Felix T & Elias — the car actually cost 530€ but I am only charging the agreed 350€ (I cover the rest). Plus gas 100€ and a speeding ticket 100€. Your 5-way split.',
  'nikos':    'Uni study group materials — wood 164.99€, aluminum extrusion 20€, screws 5€. Your 5-way split.',
  'brooklyn': 'Uni study group materials — wood 164.99€, aluminum extrusion 20€, screws 5€. Your 5-way split.',
  'nishant':  'Uni study group materials — wood 164.99€, aluminum extrusion 20€, screws 5€. Your 5-way split.',
  'talitsch': 'Studienzeit-Hilfe — du hast schon das meiste zurückgezahlt, fehlen noch 50€.',
};

data.forEach((d) => { if (en[d.characterSlug]) d.backstory = en[d.characterSlug]; });

// Local copy (UTF-8, real chars)
fs.writeFileSync('data/debtors.json', JSON.stringify(data, null, 2), 'utf8');

// ASCII-safe compact JSON for wrangler via PowerShell `type` (which mangles non-ASCII).
// Escape every code-point > 127 as \uXXXX.
const compact = JSON.stringify(data);
let asciiSafe = '';
for (const ch of compact) {
  const cp = ch.codePointAt(0);
  if (cp > 127) {
    asciiSafe += '\\u' + cp.toString(16).padStart(4, '0');
  } else {
    asciiSafe += ch;
  }
}
const compactPath = path.join(os.tmpdir(), 'payleo-debtors-min.json');
fs.writeFileSync(compactPath, asciiSafe, 'utf8');

console.log('Local data/debtors.json: real UTF-8 chars, ' + data.length + ' debtors');
console.log('Wrangler-safe ASCII compact: ' + compactPath + ' (' + fs.statSync(compactPath).size + ' bytes)');
console.log('Sample (Felix T): ' + data.find((d) => d.characterSlug === 'felix-t').backstory.substring(0, 100) + '…');
