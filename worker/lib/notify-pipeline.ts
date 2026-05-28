// worker/lib/notify-pipeline.ts
// Tiered-retry notification: Telegram (3s) → Resend (5s) → DO-queue (Phase 4 drain).
// Never throws — user always sees success state regardless of channel outcome.
import type { Env } from '../durable-object';
import { sendTelegram } from './telegram';
import { sendResendEmail } from './resend';
import {
  buildTelegramText,
  buildEmailText,
  type NotifyParams,
} from './notify-text';

interface PipelineParams extends NotifyParams {
  env: Env;
  doStub: DurableObjectStub<import('../durable-object').PayLeoDurableObject>;
}

export async function notifyWithFallback(params: PipelineParams): Promise<void> {
  const { env, doStub, ...notifyParams } = params;

  // Attempt 1: Telegram
  const tgText = buildTelegramText(notifyParams);
  const tgResult = await sendTelegram(
    env.PAYLEO_TELEGRAM_BOT_TOKEN,
    env.PAYLEO_TELEGRAM_CHAT_ID,
    tgText
  );
  if (tgResult.ok) return;

  // Attempt 2: Resend email backup
  const { subject, text: emailText } = buildEmailText(notifyParams);
  const emailResult = await sendResendEmail({
    apiKey: env.PAYLEO_RESEND_API_KEY,
    to: env.PAYLEO_NOTIFY_EMAIL,
    subject,
    text: emailText,
  });
  if (emailResult.ok) return;

  // Attempt 3: Queue in DO for lazy-drain (Phase 4 admin-pageload retry).
  const payload = JSON.stringify({
    ...notifyParams,
    tgError: tgResult.error,
    emailError: emailResult.error,
    queuedAt: Date.now(),
  });
  try {
    await doStub.queueNotification(payload);
  } catch (err) {
    // Last-resort: log only. User still sees success.
    console.error('[notify] DO-queue write failed', err);
  }

  console.error('[notify] Both channels failed. Queued in DO.', {
    tgError: tgResult.error,
    emailError: emailResult.error,
  });
}
