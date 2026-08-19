import type { ExpiringListing } from '@/lib/db/listings-admin';

/**
 * The expiry digest's body (ROADMAP W2-4). PURE — listings in, subject and
 * text out — for the same reason `lib/admin/validation.ts` is: it is the part
 * with the judgement in it (what counts as urgent, how a date is written for a
 * Paraguayan reader), and it must be testable without SMTP, a database or a
 * clock.
 */

const DAY = 86_400;

export interface DigestLine {
  name: string;
  slug: string;
  ciudadLabel: string;
  /** Which product is ending, in the order it ends. */
  items: { kind: 'premium' | 'portada'; endsAt: number; daysLeft: number }[];
}

/** `YYYY-MM-DD` in America/Asunción, from a unix timestamp. */
export function asuncionDate(seconds: number): string {
  return new Date((seconds - 3 * 3600) * 1000).toISOString().slice(0, 10);
}

export function buildDigestLines(rows: ExpiringListing[], nowSeconds: number): DigestLine[] {
  return rows
    .map((row) => {
      const items: DigestLine['items'] = [];
      if (row.premiumUntil !== null && row.premiumUntil > nowSeconds) {
        items.push({
          kind: 'premium',
          endsAt: row.premiumUntil,
          // Ceil, not floor: "expires in 0 days" reads as "already gone" and
          // sends nobody to the phone.
          daysLeft: Math.ceil((row.premiumUntil - nowSeconds) / DAY),
        });
      }
      if (row.featuredUntil !== null && row.featuredUntil > nowSeconds) {
        items.push({
          kind: 'portada',
          endsAt: row.featuredUntil,
          daysLeft: Math.ceil((row.featuredUntil - nowSeconds) / DAY),
        });
      }
      items.sort((a, b) => a.endsAt - b.endsAt);
      return { name: row.name, slug: row.slug, ciudadLabel: row.ciudadLabel, items };
    })
    .filter((line) => line.items.length > 0)
    .sort((a, b) => a.items[0]!.endsAt - b.items[0]!.endsAt);
}

export interface Digest {
  subject: string;
  text: string;
  /** How many businesses the digest names. Zero means it is not worth sending. */
  count: number;
}

export function buildExpiryDigest(
  rows: ExpiringListing[],
  nowSeconds: number,
  siteUrl: string,
): Digest {
  const lines = buildDigestLines(rows, nowSeconds);

  if (lines.length === 0) {
    // A weekly "nothing to do" is how a digest becomes something people filter
    // to a folder they stop opening. The caller decides not to send this.
    return { subject: 'Sin vencimientos próximos', text: 'No hay nada por vencer en los próximos días.', count: 0 };
  }

  const body = lines
    .map((line) => {
      const parts = line.items
        .map((item) => {
          const label = item.kind === 'premium' ? 'Premium' : 'Destacado en portada';
          const days = item.daysLeft === 1 ? '1 día' : `${item.daysLeft} días`;
          return `${label} vence el ${asuncionDate(item.endsAt)} (${days})`;
        })
        .join(' · ');
      return `• ${line.name} — ${line.ciudadLabel}\n  ${parts}\n  ${siteUrl}/lugar/${line.slug}`;
    })
    .join('\n\n');

  return {
    subject: `${lines.length} ${lines.length === 1 ? 'negocio' : 'negocios'} por vencer`,
    text:
      `Estos negocios tienen un paquete que vence pronto. Llamalos antes de que se corte.\n\n${body}\n\n` +
      `— negocio.com.py\n`,
    count: lines.length,
  };
}
