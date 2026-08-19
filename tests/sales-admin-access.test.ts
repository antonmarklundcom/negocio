import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import { listSales, listSalesForExport, salesMonthTotals } from '@/lib/db/sales-admin';

/**
 * Access tests for `lib/db/sales-admin.ts`, same canary shape as the rest.
 *
 * Admin-only throughout, including the export: an editor sells nothing, and
 * until the `sales` role exists (D4) nobody but an admin has any business
 * reading the books.
 *
 * CANARY: comment out any `requireRole` line in `lib/db/sales-admin.ts` and
 * re-run this file — every test below must fail. Restore the guard afterwards.
 */

function recordingDb(): { db: Db; touched: string[] } {
  const touched: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      const name = String(prop);
      if (name === 'then' || name === 'catch' || name === 'finally') return undefined;
      touched.push(name);
      return () => {
        throw new Error(`the database was reached: .${name}()`);
      };
    },
  };
  return { db: new Proxy({}, handler) as unknown as Db, touched };
}

const ANONYMOUS = null;
const EDITOR: SessionUser = { id: 2, role: 'editor', ownerId: null, mustChangePassword: false };
const ADMIN: SessionUser = { id: 1, role: 'admin', ownerId: null, mustChangePassword: false };

const RANGES = [
  { start: new Date('2026-07-01T03:00:00Z'), end: new Date('2026-08-01T03:00:00Z'), monthLabel: 'julio de 2026' },
];

const CASES = [
  { name: 'listSales', call: (a: SessionUser | null, db: Db) => listSales(a, {}, db) },
  { name: 'listSalesForExport', call: (a: SessionUser | null, db: Db) => listSalesForExport(a, undefined, db) },
  { name: 'salesMonthTotals', call: (a: SessionUser | null, db: Db) => salesMonthTotals(a, RANGES, db) },
];

describe('lib/db/sales-admin — the authorization boundary', () => {
  describe.each(CASES)('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(EDITOR, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ADMIN, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  it('salesMonthTotals asks the database nothing for an empty range list', async () => {
    const { db, touched } = recordingDb();
    await expect(salesMonthTotals(ADMIN, [], db)).resolves.toEqual([]);
    expect(touched).toEqual([]);
  });

  it('there is no createSale — a sale is written with the package it pays for', async () => {
    // Not a formality. A standalone "record a sale" function is exactly how the
    // books and the packages start disagreeing, so the module must not grow one.
    const module = await import('@/lib/db/sales-admin');
    expect(Object.keys(module).filter((k) => /create|insert|record/i.test(k))).toEqual([]);
  });
});
