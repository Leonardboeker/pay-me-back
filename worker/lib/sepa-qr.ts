// worker/lib/sepa-qr.ts
// Phase 8 — server-side EPC SEPA QR builder for /api/qr endpoint.
// Worker variant: uses SVG output (canvas-free) since Cloudflare Workers has no DOM.
// Returns a data URL the frontend can drop into <img src="...">.
import generateQrCode from 'sepa-payment-qr-code';
import QRCode from 'qrcode';

export async function buildEpcQrDataUrl(args: {
  holder: string;
  iban: string;
  bic: string;
  amount: number; // EUR (not cents)
  purpose: string;
}): Promise<string> {
  const payload = generateQrCode({
    name: args.holder,
    iban: args.iban.replace(/\s+/g, ''),
    bic: args.bic,
    amount: args.amount,
    unstructuredReference: args.purpose,
  });
  // SVG output is canvas-free → works in Cloudflare Workers runtime.
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    width: 180,
    margin: 1,
  });
  // btoa is a Worker global; encode utf-8 first since SVG may contain non-ASCII (umlauts in holder name).
  const utf8Bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
