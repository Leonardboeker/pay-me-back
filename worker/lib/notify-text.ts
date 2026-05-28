// worker/lib/notify-text.ts
// Notification text builders for Telegram + Resend (CONTEXT D-03 templates).
// Phase 3.1: "Quest Edition" tone — pixel-RPG framing matching the new UI.
// Signatures unchanged (NotifyParams + return type stable).
// fmt(cents) = "${rounded} €" — integer euros, no decimals (notifications stay terse).
export type Modality = 'einmalzahlung' | 'raten' | 'aufschub';

export interface NotifyParams {
  name: string;
  amountCents: number; // EFFECTIVE total (base debt + giftCents)
  modality: Modality;
  sliderBefore: number; // cents
  sliderAfter: number; // cents
  installments?: number;
  startDate?: string;
  reason?: string;
  giftCents?: number; // Phase 8 — optional extra paid on top of the debt
}

const fmt = (c: number): string => `${Math.round(c / 100)} €`;

export function buildTelegramText(params: NotifyParams): string {
  const { name, amountCents, modality, sliderBefore, sliderAfter } = params;
  const gift = params.giftCents ?? 0;
  const giftLine = gift > 0 ? ` (+${fmt(gift)} bonus)` : '';

  if (modality === 'einmalzahlung') {
    return `💸 QUEST UPDATE: ${name} chose 'Pay in full' (${fmt(amountCents)}${giftLine}) — HP: ${fmt(sliderAfter)} / ${fmt(sliderBefore)}.`;
  }

  if (modality === 'raten') {
    const plan =
      params.installments && params.startDate
        ? `${params.installments}x starting ${params.startDate}`
        : 'plan to follow';
    return `📋 QUEST UPDATE: ${name} chose 'Installments' (${plan}) — Item-Stack: ${fmt(amountCents)}${giftLine}. HP: ${fmt(sliderAfter)} / ${fmt(sliderBefore)}.`;
  }

  // aufschub — slider unchanged, giftCents always 0 (server-enforced)
  const reasonLine = params.reason
    ? `\n💬 Reason: "${params.reason}"`
    : '\n💬 Reason: (no details)';
  return `⏳ QUEST UPDATE: ${name} needs a delay (${fmt(amountCents)}). HP unchanged: ${fmt(sliderBefore)}.${reasonLine}`;
}

export function buildEmailText(params: NotifyParams): {
  subject: string;
  text: string;
} {
  const subject = `PayLeo QUEST UPDATE — ${params.name}`;
  const modalityLabel =
    params.modality === 'einmalzahlung'
      ? 'Pay in full'
      : params.modality === 'raten'
        ? 'Installments'
        : 'Delay';

  let body = `QUEST UPDATE\n`;
  body += `Player: ${params.name} (${fmt(params.amountCents)})\n`;
  body += `Action: ${modalityLabel}\n`;
  body += `HP: ${fmt(params.sliderBefore)} → ${fmt(params.sliderAfter)}\n`;

  if (params.modality === 'raten' && (params.installments || params.startDate)) {
    body += `Plan: ${params.installments ?? '?'}x starting ${params.startDate ?? '?'}\n`;
  }
  if (params.modality === 'aufschub' && params.reason) {
    body += `Reason: "${params.reason}"\n`;
  }
  body += `\n(Email backup — Telegram API was unreachable)`;

  return { subject, text: body };
}
