// src/lib/sepa-qr.ts
// Build EPC SEPA QR-Code as inline data URL — Node-side ONLY (call from Astro frontmatter).
// Zero client bundle impact. Per UI-SPEC §10 + RESEARCH §Q3.
import generateQrCode from 'sepa-payment-qr-code';
import QRCode from 'qrcode';

export async function buildEpcQrDataUrl(args: {
  holder: string;
  iban: string;
  bic: string;
  amount: number;
  purpose: string;
}): Promise<string> {
  const payload = generateQrCode({
    name: args.holder,
    iban: args.iban.replace(/\s+/g, ''),  // EPC spec: no spaces in IBAN field
    bic: args.bic,
    amount: args.amount,                   // EUR assumed by library
    unstructuredReference: args.purpose,
  });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    width: 180,
    margin: 1,
  });
}
