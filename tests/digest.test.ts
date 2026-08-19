import { describe, expect, it } from 'vitest';
import { asuncionDate, buildDigestLines, buildExpiryDigest } from '@/lib/admin/digest';
import type { ExpiringListing } from '@/lib/db/listings-admin';

/**
 * `lib/admin/digest.ts` is pure — listings in, subject and text out — so this
 * needs no SMTP, no database and no clock. `now` is a parameter everywhere.
 */

const NOW = 1_760_000_000; // a fixed instant; nothing here reads the wall clock
const DAY = 86_400;

function listing(over: Partial<ExpiringListing> = {}): ExpiringListing {
  return {
    id: 'a',
    slug: 'panaderia-la-espiga',
    name: 'Panadería La Espiga',
    ciudadLabel: 'Asunción',
    premiumUntil: null,
    featuredUntil: null,
    ...over,
  };
}

describe('asuncionDate', () => {
  it('renders the Paraguayan calendar day, not the UTC one', () => {
    // 01:00 UTC is still the previous day in Asunción (UTC-3).
    const utcJustAfterMidnight = Math.floor(Date.parse('2026-08-20T01:00:00Z') / 1000);
    expect(asuncionDate(utcJustAfterMidnight)).toBe('2026-08-19');
  });
});

describe('buildDigestLines', () => {
  it('lists both products for one business, soonest first', () => {
    const [line] = buildDigestLines(
      [listing({ premiumUntil: NOW + 10 * DAY, featuredUntil: NOW + 3 * DAY })],
      NOW,
    );
    expect(line!.items.map((i) => i.kind)).toEqual(['portada', 'premium']);
  });

  it('rounds days UP', () => {
    // "expires in 0 days" reads as already gone and sends nobody to the phone.
    const [line] = buildDigestLines([listing({ premiumUntil: NOW + DAY / 2 })], NOW);
    expect(line!.items[0]!.daysLeft).toBe(1);
  });

  it('drops a business whose packages have already expired', () => {
    expect(buildDigestLines([listing({ premiumUntil: NOW - DAY })], NOW)).toEqual([]);
  });

  it('orders businesses by whichever package expires first', () => {
    const lines = buildDigestLines(
      [
        listing({ id: 'a', name: 'Tarde', premiumUntil: NOW + 12 * DAY }),
        listing({ id: 'b', name: 'Temprano', featuredUntil: NOW + 2 * DAY }),
      ],
      NOW,
    );
    expect(lines.map((l) => l.name)).toEqual(['Temprano', 'Tarde']);
  });
});

describe('buildExpiryDigest', () => {
  it('reports a count of zero when nothing is expiring, so the caller can skip the send', () => {
    // A weekly "nothing to do" is how a digest becomes a folder nobody opens.
    const digest = buildExpiryDigest([], NOW, 'https://negocio.com.py');
    expect(digest.count).toBe(0);
  });

  it('names the business, the product, the date and the URL', () => {
    const digest = buildExpiryDigest(
      [listing({ premiumUntil: NOW + 5 * DAY })],
      NOW,
      'https://negocio.com.py',
    );
    expect(digest.count).toBe(1);
    expect(digest.subject).toBe('1 negocio por vencer');
    expect(digest.text).toContain('Panadería La Espiga');
    expect(digest.text).toContain('Asunción');
    expect(digest.text).toContain('Premium vence el');
    expect(digest.text).toContain('(5 días)');
    expect(digest.text).toContain('https://negocio.com.py/lugar/panaderia-la-espiga');
  });

  it('says "1 día" and not "1 días"', () => {
    const digest = buildExpiryDigest([listing({ featuredUntil: NOW + DAY })], NOW, 'https://x');
    expect(digest.text).toContain('(1 día)');
  });

  it('pluralises the subject', () => {
    const digest = buildExpiryDigest(
      [listing({ id: 'a', premiumUntil: NOW + DAY }), listing({ id: 'b', slug: 'otro', premiumUntil: NOW + 2 * DAY })],
      NOW,
      'https://x',
    );
    expect(digest.subject).toBe('2 negocios por vencer');
  });
});
