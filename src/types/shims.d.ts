// src/types/shims.d.ts
// Type shim for sepa-payment-qr-code (CJS-only, no shipped types).
declare module 'sepa-payment-qr-code' {
  type Options = {
    name: string;
    iban: string;
    bic?: string;
    amount?: number;
    purposeCode?: string;
    unstructuredReference?: string;
    information?: string;
  };
  const generateQrCode: (opts: Options) => string;
  export default generateQrCode;
}
