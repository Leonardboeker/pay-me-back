// src/lib/purpose.ts
// Build the SEPA Verwendungszweck for a debtor (D-03).
// Convention: PayLeo-<Vorname>-2026
export function buildPurpose(firstName: string): string {
  // Strip non-alphanumeric to keep the Verwendungszweck clean in banking apps.
  const safe = firstName.replace(/[^A-Za-z0-9]/g, '');
  return `PayLeo-${safe}-2026`;
}
