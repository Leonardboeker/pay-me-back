// scripts/test-notify.mjs
// Health-check: sends a test Telegram + Resend message to verify both channels work.
// Run weekly per D-04 (Wednesday 9 AM calendar reminder).
//
// Usage:
//   $env:PAYLEO_TELEGRAM_BOT_TOKEN="..."; $env:PAYLEO_TELEGRAM_CHAT_ID="..."; ...
//   npm run test:notify
import { sendTelegram } from '../worker/lib/telegram.ts';
import { sendResendEmail } from '../worker/lib/resend.ts';

const BOT_TOKEN = process.env.PAYLEO_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.PAYLEO_TELEGRAM_CHAT_ID;
const RESEND_KEY = process.env.PAYLEO_RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.PAYLEO_NOTIFY_EMAIL;

if (!BOT_TOKEN || !CHAT_ID || !RESEND_KEY || !NOTIFY_EMAIL) {
  console.error(
    '[test:notify] FATAL: set PAYLEO_TELEGRAM_BOT_TOKEN, PAYLEO_TELEGRAM_CHAT_ID, PAYLEO_RESEND_API_KEY, PAYLEO_NOTIFY_EMAIL'
  );
  process.exit(1);
}

const testText = `🧪 PayLeo Notification Test — ${new Date().toISOString()}\nBeide Kanäle OK? Wenn du das siehst: ja.`;

console.log('[test:notify] Testing Telegram...');
const tg = await sendTelegram(BOT_TOKEN, CHAT_ID, testText);
if (tg.ok) {
  console.log('[test:notify] Telegram: OK');
} else {
  console.error('[test:notify] Telegram: FAIL —', tg.error);
}

console.log('[test:notify] Testing Resend...');
const email = await sendResendEmail({
  apiKey: RESEND_KEY,
  to: NOTIFY_EMAIL,
  subject: 'PayLeo Notification Test',
  text: testText + '\n\n(Email-Kanal Test)',
});
if (email.ok) {
  console.log('[test:notify] Resend: OK');
} else {
  console.error('[test:notify] Resend: FAIL —', email.error);
}

if (!tg.ok || !email.ok) {
  process.exit(1);
}
console.log('[test:notify] Both channels OK.');
