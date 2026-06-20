/**
 * Locale helpers for Paraguay (es-PY).
 * Currency ₲ (PYG) with thousands as '.', phones grouped like '021 584 220'.
 */

export function formatGs(value: number): string {
  return '₲ ' + value.toLocaleString('es-PY', { maximumFractionDigits: 0 });
}

/**
 * Display a Paraguayan phone number with readable grouping.
 * Accepts already-formatted strings and light-touch normalises digit runs.
 */
export function formatPhone(raw: string): string {
  const trimmed = raw.trim();
  // Already contains spacing/punctuation the owner chose — respect it.
  if (/[\s()+-]/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  // Local landline/mobile (e.g. 021584220 / 0981123456) → 3-3-3 grouping.
  if (digits.length >= 9 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`.trim();
  }
  return trimmed;
}

/** Strip a phone/whatsapp value to E.164 digits for wa.me / tel: links. */
export function toWaDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  // Local 0-prefixed numbers → Paraguay country code 595.
  if (d.startsWith('0')) d = '595' + d.slice(1);
  return d;
}

/** Build a wa.me deep link with an optional prefilled message. */
export function waLink(whatsapp: string, text?: string): string {
  const base = `https://wa.me/${toWaDigits(whatsapp)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return (ch || '?').toUpperCase();
}
