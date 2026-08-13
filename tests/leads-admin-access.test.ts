import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import { countLeadsSince, getListingLeadReport, listLeads } from '@/lib/db/leads-admin';

/**
 * Access tests for `lib/db/leads-admin.ts`, same canary shape as
 * `tests/listings-admin-access.test.ts`.
 *
 * CANARY: comment out any `requireRole` line in `lib/db/leads-admin.ts` and
 * re-run this file — every test below must fail. Restore the guard afterwards.
 */

interface Recorder {
  db: Db;
  touched: string[];
}

function recordingDb(): Recorder {
  const touched: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
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

function session(role: UserRole, id = 1): SessionUser {
  return { id, role, ownerId: null, mustChangePassword: false };
}

const ANONYMOUS = null;
const EDITOR = session('editor', 2);
const ADMIN = session('admin', 1);

describe('lib/db/leads-admin — the authorization boundary', () => {
  describe('listLeads — admin only', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(listLeads(ANONYMOUS, { page: 1 }, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(listLeads(EDITOR, { page: 1 }, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(listLeads(ADMIN, { page: 1 }, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('countLeadsSince — admin only', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(countLeadsSince(ANONYMOUS, new Date(), db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(countLeadsSince(EDITOR, new Date(), db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });
  });

  describe('getListingLeadReport — admin and editor', () => {
    const range = { start: new Date('2026-08-01T03:00:00Z'), end: new Date('2026-09-01T03:00:00Z') };

    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(getListingLeadReport(ANONYMOUS, 'x', range, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(getListingLeadReport(EDITOR, 'x', range, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(getListingLeadReport(ADMIN, 'x', range, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });
});
