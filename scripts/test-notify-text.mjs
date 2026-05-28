// scripts/test-notify-text.mjs
// Unit tests for worker/lib/notify-text.ts builders.
// Phase 3.1: Updated for "Quest Edition" tone — HP/QUEST UPDATE framing.
// Locale: English (post-locale-switch).
// Run via: node --import tsx --test scripts/test-notify-text.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTelegramText,
  buildEmailText,
} from '../worker/lib/notify-text.ts';

test('buildTelegramText einmalzahlung — 💸 QUEST UPDATE + name + amount + HP arrow', () => {
  const out = buildTelegramText({
    name: 'Max',
    amountCents: 5000,
    modality: 'einmalzahlung',
    sliderBefore: 38000,
    sliderAfter: 33000,
  });
  assert.match(out, /💸/, 'must include 💸 emoji');
  assert.match(out, /QUEST UPDATE/, 'must include QUEST UPDATE banner');
  assert.match(out, /Max/, 'must include name');
  assert.match(out, /50 €/, 'must include formatted amount');
  assert.match(out, /HP:/, 'must include HP: label');
  assert.match(out, /330 €.*\/.*380 €/, 'must include after / before HP');
  assert.match(out, /Pay in full/, 'must label modality');
});

test('buildTelegramText raten — 📋 QUEST UPDATE + Installments + Item-Stack', () => {
  const out = buildTelegramText({
    name: 'Anna',
    amountCents: 9000,
    modality: 'raten',
    sliderBefore: 38000,
    sliderAfter: 29000,
    installments: 2,
    startDate: '2026-06-05',
  });
  assert.match(out, /📋/, 'must include 📋 emoji');
  assert.match(out, /QUEST UPDATE/, 'must include QUEST UPDATE banner');
  assert.match(out, /Installments/, 'must label Installments');
  assert.match(out, /2x starting 2026-06-05/, 'must include plan');
  assert.match(out, /Item-Stack: 90 €/, 'must include Item-Stack with amount');
  assert.match(out, /HP: 290 €/, 'must include HP after');
});

test('buildTelegramText aufschub with reason — ⏳ QUEST UPDATE + unchanged + Reason quote', () => {
  const out = buildTelegramText({
    name: 'Tom',
    amountCents: 5000,
    modality: 'aufschub',
    sliderBefore: 38000,
    sliderAfter: 38000,
    reason: 'waiting on paycheck',
  });
  assert.match(out, /⏳/, 'must include ⏳ emoji');
  assert.match(out, /QUEST UPDATE/, 'must include QUEST UPDATE banner');
  assert.match(out, /needs a delay/, 'must say needs a delay');
  assert.match(out, /unchanged/, 'must say HP unchanged');
  assert.match(out, /380 €/, 'must include HP amount');
  assert.match(out, /Reason:.*"waiting on paycheck"/, 'must include quoted reason');
  assert.match(out, /💬/, 'must include 💬 quote emoji');
  assert.doesNotMatch(out, /→/, 'must NOT include arrow (HP unchanged)');
});

test('buildTelegramText aufschub without reason — "no details" label', () => {
  const out = buildTelegramText({
    name: 'Sam',
    amountCents: 5000,
    modality: 'aufschub',
    sliderBefore: 38000,
    sliderAfter: 38000,
  });
  assert.match(out, /needs a delay/, 'must say needs a delay');
  assert.match(out, /no details/, 'must label "(no details)"');
  assert.match(out, /💬/, 'must include 💬 marker (even when reason missing)');
});

test('buildEmailText — subject QUEST UPDATE + body HP line', () => {
  const out = buildEmailText({
    name: 'Max',
    amountCents: 5000,
    modality: 'einmalzahlung',
    sliderBefore: 38000,
    sliderAfter: 33000,
  });
  assert.match(out.subject, /PayLeo/, 'subject must include PayLeo');
  assert.match(out.subject, /QUEST UPDATE/, 'subject must include QUEST UPDATE');
  assert.match(out.subject, /Max/, 'subject must include name');
  assert.match(out.text, /Pay in full/, 'body must label modality');
  assert.match(out.text, /HP: 380 € → 330 €/, 'body must include HP arrow line');
  assert.match(out.text, /Player: Max/, 'body must include Player line');
  assert.match(out.text, /Email backup/, 'body must say Email backup fallback');
});
