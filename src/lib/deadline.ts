// src/lib/deadline.ts
// Hard deadline for the campaign.
// Change DEADLINE_ISO to a date relevant to you — e.g. "2026-07-15T23:59:59+02:00".
// Format is ISO-8601 with an explicit timezone offset; never rely on the runtime's local TZ.
// The matching Worker-side value lives in wrangler.toml as PAYLEO_DEADLINE — keep them in sync.
export const DEADLINE_ISO = '2099-12-31T23:59:59+00:00';
export const DEADLINE_MS = new Date(DEADLINE_ISO).getTime();

/**
 * Returns true if the given moment is past the trip-departure deadline.
 * @param now - optional override for testing. Defaults to current wall clock.
 */
export function isPostDeadline(now: Date = new Date()): boolean {
  return now.getTime() > DEADLINE_MS;
}

/** Days remaining until DEADLINE_MS, clamped to ≥ 0.
 *  Math.ceil so any non-zero remaining time rounds up to "≥1 day".
 *  Post-deadline returns 0 — caller should use isPostDeadline() to decide which UI to render. */
export function getDaysRemaining(now: Date = new Date()): number {
  return Math.max(0, Math.ceil((DEADLINE_MS - now.getTime()) / 86400000));
}
