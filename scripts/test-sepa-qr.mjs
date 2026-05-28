// scripts/test-sepa-qr.mjs
// Smoke test: confirms sepa-payment-qr-code + qrcode integrate and produce data URLs.
import test from 'node:test';
import assert from 'node:assert/strict';
import generateQrCode from 'sepa-payment-qr-code';
import QRCode from 'qrcode';

test('generateQrCode returns EPC024-22 payload string', () => {
  const payload = generateQrCode({
    name: 'Leonard Böker',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    amount: 50.00,
    unstructuredReference: 'PayLeo-Max-2026',
  });
  // EPC024-22 spec: payload starts with "BCD" service tag
  assert.ok(payload.startsWith('BCD\n'), `expected BCD\\n... got: ${payload.slice(0, 20)}`);
  // Must contain the IBAN without spaces
  assert.ok(payload.includes('DE89370400440532013000'), 'payload missing IBAN');
  // Must contain the amount in EUR
  assert.ok(payload.includes('EUR50') || payload.includes('EUR50.00') || payload.includes('EUR50,00'),
    `amount not found in payload: ${payload}`);
  // Must contain the Verwendungszweck
  assert.ok(payload.includes('PayLeo-Max-2026'), 'payload missing Verwendungszweck');
});

test('QRCode.toDataURL renders payload to PNG data URL', async () => {
  const payload = generateQrCode({
    name: 'Leonard Böker',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    amount: 50.00,
    unstructuredReference: 'PayLeo-Max-2026',
  });
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', width: 180, margin: 1 });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'expected PNG data URL');
  // Size budget: UI-SPEC §15 caps inline EPC-QR at ≤ 8 KB
  assert.ok(dataUrl.length < 8192, `data URL too large: ${dataUrl.length} bytes (cap 8192)`);
});
