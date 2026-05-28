// src/lib/payment-methods.ts
// Optional payment methods beyond the built-in PayPal + SEPA + SEPA-QR.
// Each method lights up automatically if its env var is set; otherwise it's
// silently omitted from the per-token page.
//
// Configure in .env (local) and in the Cloudflare Pages dashboard (production).
// Re-deploy after changing — values are inlined at build time.

export type ExtraMethodKind =
  | 'stripe'
  | 'revolut'
  | 'wise'
  | 'bunq'
  | 'bizum'
  | 'twint'
  | 'swish'
  | 'mbway'
  | 'btc'
  | 'eth'
  | 'kofi'
  | 'bmac';

export interface ExtraMethod {
  kind: ExtraMethodKind;
  label: string;
  /** "Open in app" / "Scan QR" / "Copy address" — disambiguates CTAs */
  cta: 'open' | 'copy' | 'scan';
  /** Outbound URL when cta === 'open' */
  url?: string;
  /** Copy-to-clipboard value when cta === 'copy' / 'scan' (also encoded into QR) */
  value?: string;
  /** Short helper line beneath the CTA */
  hint?: string;
  /** Theme accent — matches existing palette tokens */
  accent: 'primary' | 'secondary' | 'tertiary' | 'neutral';
  /** Inline SVG icon string */
  icon: string;
}

// ── icon library (inline SVGs, no external deps) ──
const ICONS = {
  stripe:    `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M14.7 11.6c0-.9.7-1.2 1.9-1.2 1.7 0 3.8.5 5.5 1.4V6.5c-1.9-.7-3.7-1-5.5-1-4.5 0-7.5 2.3-7.5 6.2 0 6 8.3 5 8.3 7.6 0 1-.9 1.3-2.2 1.3-1.8 0-4.2-.7-6-1.7v5.4c2 .8 4.1 1.2 6 1.2 4.6 0 7.7-2.2 7.7-6.2 0-6.4-8.4-5.3-8.4-7.7z"/></svg>`,
  revolut:   `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M5 4h11.5c3.6 0 6.5 2.9 6.5 6.5 0 2.9-1.9 5.4-4.5 6.2L26 28h-6.5l-6.5-10v10H8V4h-3zm6 4v6h5.5c1.7 0 3-1.3 3-3s-1.3-3-3-3H11z"/></svg>`,
  wise:      `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M4 6h6l3.5 11L17 6h4l3.5 11L28 6h-3.5l-2 7-2.5-7h-3l-2.5 7-2-7H4zm6 14h18v3H10zm0 4h14v3H10z"/></svg>`,
  bunq:      `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 11h4v4h-4zm6 6h4v4h-4z"/></svg>`,
  bizum:     `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M9 4h14c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3zm7 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm-5 12h10v2H11z"/></svg>`,
  twint:     `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 14h12v4H10z"/><circle cx="13" cy="16" r="2"/><circle cx="19" cy="16" r="2"/></svg>`,
  swish:     `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M6 16c0-5.5 4.5-10 10-10 4.4 0 8.2 2.9 9.5 6.8L23 14c-.9-2.9-3.6-5-6.9-5-3.9 0-7.1 3.2-7.1 7.1 0 .6.1 1.3.2 1.9L4 19c-.3-1-.5-2-.5-3zm22 0c0 5.5-4.5 10-10 10-4.4 0-8.2-2.9-9.5-6.8L11 18c.9 2.9 3.6 5 6.9 5 3.9 0 7.1-3.2 7.1-7.1 0-.6-.1-1.3-.2-1.9L28 13c.3 1 .5 2 .5 3z"/></svg>`,
  mbway:     `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M6 8h4l4 8 4-8h4v16h-3V13l-4 7h-2l-4-7v11H6V8zm18 0h2l3 8 3-8h-7v16h2V12l2 5h1l2-5v12h-2V8z"/></svg>`,
  btc:       `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path fill="white" d="M21 14.5c.3-2-1.3-3.2-3.4-3.9l.7-2.7-1.7-.4-.6 2.7-1.4-.3.7-2.7-1.7-.4-.7 2.7-2.8-.7-.4 1.8s1.5.3 1.5.4c.8.2.9.7.9 1.1l-2.1 8.3c-.1.3-.3.6-.8.5-.1 0-1.5-.4-1.5-.4l-.8 1.9 2.7.7-.7 2.8 1.7.4.7-2.7 1.4.3-.7 2.7 1.7.4.7-2.8c2.9.5 5 .3 5.9-2.3.7-2.1-.1-3.3-1.5-4.1 1.1-.2 1.9-1 2.1-2.4zm-3.8 5.5c-.5 2.1-4 .9-5.2.7l.9-3.6c1.2.3 4.8.9 4.3 2.9zm.5-5.5c-.5 1.9-3.4.9-4.4.7l.8-3.3c1 .3 4.1.7 3.6 2.6z"/></svg>`,
  eth:       `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 2 7 16.5 16 21l9-4.5L16 2zm0 22-9-5 9 13 9-13-9 5z"/></svg>`,
  kofi:      `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M5 6h18c2.2 0 4 1.8 4 4v2c4-.5 5 2 5 4 0 4-3 5-6 5h-1c-.8 4-4.4 7-9 7h-7c-5 0-8-3-8-8V6zm22 6v4h1c1.1 0 2-.5 2-2s-.9-2-2-2h-1zM10 10c-.6 0-1 .4-1 1v1c0 .6.4 1 1 1s1-.4 1-1v-1c0-.6-.4-1-1-1zm5 0c-.6 0-1 .4-1 1v1c0 .6.4 1 1 1s1-.4 1-1v-1c0-.6-.4-1-1-1zm-7 6c0 2 1 4 3 4h6c2 0 3-2 3-4H8z"/></svg>`,
  bmac:      `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M6 12h20l-1 4c4 0 4 6 0 6 0 4-3 7-7 7h-4c-4 0-7-3-7-7l-1-10zm4 4 1 6c0 2 1 3 3 3h4c2 0 3-1 3-3l1-6H10zM12 4c-1 1 0 2 0 3s-1 2 0 3M16 4c-1 1 0 2 0 3s-1 2 0 3M20 4c-1 1 0 2 0 3s-1 2 0 3"/></svg>`,
};

/**
 * Read env vars (Astro inlines `import.meta.env.PAYLEO_*` at build time)
 * and assemble the list of extra payment methods for a debtor.
 *
 * @param amount - debt amount in EUR (integer or float)
 */
export function getExtraPaymentMethods(amount: number): ExtraMethod[] {
  const methods: ExtraMethod[] = [];
  const amountFmt = amount % 1 === 0 ? String(Math.trunc(amount)) : amount.toFixed(2);
  const amountCents = Math.round(amount * 100);

  // ── Stripe Payment Link ──
  // Set PAYLEO_STRIPE_LINK to the share URL of a Stripe Payment Link
  // (https://buy.stripe.com/...). If the link's price field is set to
  // "Customer enters amount" the ?prefilled_amount param will autofill.
  const stripe = (import.meta.env.PAYLEO_STRIPE_LINK as string | undefined)?.trim();
  if (stripe) {
    const sep = stripe.includes('?') ? '&' : '?';
    const url = `${stripe}${sep}prefilled_amount=${amountCents}&currency=eur`;
    methods.push({
      kind: 'stripe',
      label: 'Stripe (Card / Apple Pay / Google Pay)',
      cta: 'open',
      url,
      hint: 'Credit card, Apple Pay, Google Pay, SEPA Direct Debit.',
      accent: 'secondary',
      icon: ICONS.stripe,
    });
  }

  // ── Revolut.me ──
  const revolut = (import.meta.env.PAYLEO_REVOLUT_HANDLE as string | undefined)?.trim();
  if (revolut) {
    methods.push({
      kind: 'revolut',
      label: 'Revolut',
      cta: 'open',
      url: `https://revolut.me/${encodeURIComponent(revolut)}/${amountFmt}EUR`,
      hint: 'Instant if both sides use Revolut.',
      accent: 'primary',
      icon: ICONS.revolut,
    });
  }

  // ── Wise ──
  // Wise doesn't prefill amount via URL; the user enters it on the next screen.
  const wise = (import.meta.env.PAYLEO_WISE_HANDLE as string | undefined)?.trim();
  if (wise) {
    methods.push({
      kind: 'wise',
      label: 'Wise',
      cta: 'open',
      url: `https://wise.com/pay/me/${encodeURIComponent(wise)}`,
      hint: `Enter ${amountFmt} € on the Wise page.`,
      accent: 'tertiary',
      icon: ICONS.wise,
    });
  }

  // ── bunq.me ──
  const bunq = (import.meta.env.PAYLEO_BUNQ_HANDLE as string | undefined)?.trim();
  if (bunq) {
    methods.push({
      kind: 'bunq',
      label: 'bunq.me',
      cta: 'open',
      url: `https://bunq.me/${encodeURIComponent(bunq)}/${amountFmt}`,
      hint: 'Instant SEPA, no app required.',
      accent: 'neutral',
      icon: ICONS.bunq,
    });
  }

  // ── Bizum (Spain) ──
  // No URL scheme. Just display the phone number to send to.
  const bizum = (import.meta.env.PAYLEO_BIZUM_PHONE as string | undefined)?.trim();
  if (bizum) {
    methods.push({
      kind: 'bizum',
      label: 'Bizum (España)',
      cta: 'copy',
      value: bizum,
      hint: `Open your bank app → Bizum → send ${amountFmt} € to this number.`,
      accent: 'primary',
      icon: ICONS.bizum,
    });
  }

  // ── Twint (Switzerland) ──
  const twint = (import.meta.env.PAYLEO_TWINT_PHONE as string | undefined)?.trim();
  if (twint) {
    methods.push({
      kind: 'twint',
      label: 'Twint (Schweiz)',
      cta: 'copy',
      value: twint,
      hint: `Twint app → Geld senden → ${amountFmt} CHF an diese Nummer.`,
      accent: 'secondary',
      icon: ICONS.twint,
    });
  }

  // ── Swish (Sweden) ──
  const swish = (import.meta.env.PAYLEO_SWISH_NUMBER as string | undefined)?.trim();
  if (swish) {
    methods.push({
      kind: 'swish',
      label: 'Swish (Sverige)',
      cta: 'copy',
      value: swish,
      hint: `Open Swish → send ${amountFmt} SEK to this number.`,
      accent: 'tertiary',
      icon: ICONS.swish,
    });
  }

  // ── MB WAY (Portugal) ──
  const mbway = (import.meta.env.PAYLEO_MBWAY_PHONE as string | undefined)?.trim();
  if (mbway) {
    methods.push({
      kind: 'mbway',
      label: 'MB WAY (Portugal)',
      cta: 'copy',
      value: mbway,
      hint: `MB WAY app → enviar ${amountFmt} € para este número.`,
      accent: 'neutral',
      icon: ICONS.mbway,
    });
  }

  // ── Bitcoin ──
  // BIP-21 URI scheme. Amount is in BTC; we omit it since we have EUR.
  // The wallet user will enter the amount manually after scanning.
  const btc = (import.meta.env.PAYLEO_BTC_ADDRESS as string | undefined)?.trim();
  if (btc) {
    methods.push({
      kind: 'btc',
      label: 'Bitcoin',
      cta: 'scan',
      value: `bitcoin:${btc}`,
      hint: `Scan with a BTC wallet, enter ${amountFmt} € worth of BTC manually.`,
      accent: 'secondary',
      icon: ICONS.btc,
    });
  }

  // ── Ethereum ──
  // EIP-681 URI scheme.
  const eth = (import.meta.env.PAYLEO_ETH_ADDRESS as string | undefined)?.trim();
  if (eth) {
    methods.push({
      kind: 'eth',
      label: 'Ethereum',
      cta: 'scan',
      value: `ethereum:${eth}`,
      hint: `Scan with an ETH wallet, enter ${amountFmt} € worth of ETH manually.`,
      accent: 'tertiary',
      icon: ICONS.eth,
    });
  }

  // ── Ko-fi ──
  const kofi = (import.meta.env.PAYLEO_KOFI_HANDLE as string | undefined)?.trim();
  if (kofi) {
    methods.push({
      kind: 'kofi',
      label: 'Ko-fi',
      cta: 'open',
      url: `https://ko-fi.com/${encodeURIComponent(kofi)}`,
      hint: `Drop ${amountFmt} € as a one-off "coffee".`,
      accent: 'primary',
      icon: ICONS.kofi,
    });
  }

  // ── Buy Me a Coffee ──
  const bmac = (import.meta.env.PAYLEO_BUYMEACOFFEE_HANDLE as string | undefined)?.trim();
  if (bmac) {
    methods.push({
      kind: 'bmac',
      label: 'Buy Me a Coffee',
      cta: 'open',
      url: `https://buymeacoffee.com/${encodeURIComponent(bmac)}`,
      hint: `Drop ${amountFmt} € as a one-off "coffee".`,
      accent: 'secondary',
      icon: ICONS.bmac,
    });
  }

  return methods;
}
