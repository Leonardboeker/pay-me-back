// src/lib/admin-format.ts
// Format helpers for the admin dashboard. Pure functions, no DOM dependency.
// Used by the admin page IIFE when rendering table rows + activity log.

// English relative time for recent (<24h), absolute date for older.
// Uses Intl.RelativeTimeFormat (browser-native, zero dependency).
export function formatRelativeTime(timestamp: number | null): string {
  if (timestamp == null) return '—';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');

  // > 24h — absolute date in ISO short form (YYYY-MM-DD HH:mm)
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// CSS class for status badge (utilitarian — not pixel-RPG per D-01)
export function statusBadgeClass(status: 'open' | 'paid' | 'delayed'): string {
  switch (status) {
    case 'open':
      return 'status-badge status-open';
    case 'paid':
      return 'status-badge status-paid';
    case 'delayed':
      return 'status-badge status-delayed';
  }
}

// English status label for badges
export function statusLabel(status: 'open' | 'paid' | 'delayed'): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'paid':
      return 'Paid';
    case 'delayed':
      return 'Delayed';
  }
}

// Modality label — English (project switched to EN-only per 2026-05-28).
export function modalityLabel(modality: string | null): string {
  if (!modality) return '—';
  switch (modality) {
    case 'einmalzahlung':
      return 'Pay in full';
    case 'raten':
      return 'Installments';
    case 'aufschub':
      return 'Delay';
    default:
      return modality;
  }
}
