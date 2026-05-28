// worker/lib/resend.ts
// Raw fetch to Resend Send-Email API — plain text body, single recipient.
//
// The `from` address is read from PAYLEO_RESEND_FROM. If unset, falls back to
// `onboarding@resend.dev` (Resend's sandbox sender — works without verifying a
// domain, but only delivers to verified recipients). For production, verify
// your own domain in the Resend dashboard and set PAYLEO_RESEND_FROM to e.g.
// "Your Name <hello@your-domain.com>".
const RESEND_BASE = 'https://api.resend.com';
const TIMEOUT_MS = 5000;

export async function sendResendEmail(params: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
  from?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const from = params.from ?? 'pay-me-back <onboarding@resend.dev>';

  try {
    const res = await fetch(`${RESEND_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        error: `Resend ${res.status}: ${body.message ?? 'unknown'}`,
      };
    }
    return { ok: true };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Resend fetch error: ${msg}` };
  }
}
