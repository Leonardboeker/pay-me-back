// src/lib/format.ts
// Centralized format helpers for currency and IBAN display.

/** German number format: 50 → "50", 50.5 → "50,50", 50.123 → "50,12" */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('de-DE', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00" (spaces every 4). Idempotent. */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** Strip spaces from formatted IBAN for clipboard / EPC payload. Idempotent. */
export function stripIban(iban: string): string {
  return iban.replace(/\s+/g, '');
}

/** Build PayPal.me URL with German-locale amount.
 *  PayPal.me uses dot-decimal for amounts in URLs (e.g. /50.50EUR not /50,50EUR).
 *  Integer amounts get NO decimal (50EUR not 50.00EUR — cleaner URL). */
export function buildPaypalUrl(handle: string, amount: number): string {
  const amountStr = amount % 1 === 0
    ? String(Math.trunc(amount))
    : amount.toFixed(2);
  return `https://paypal.me/${handle}/${amountStr}EUR`;
}
