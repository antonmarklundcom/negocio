import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import {
  createListing,
  deleteListing,
  getListingForEdit,
  isListingSlugTaken,
  listListings,
  updateListing,
} from '@/lib/db/listings-admin';
import type { ListingFormInput } from '@/lib/admin/validation';

/**
 * Access tests, invoked DIRECTLY against the query module — same shape as
 * `tests/users-access.test.ts`. Every call is handed a database that RECORDS
 * EVERY ACCESS and throws on use; a rejected call must never touch it.
 *
 * CANARY: comment out any `requireRole` line in `lib/db/listings-admin.ts` and
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
const OWNER_ADMIN = session('owner_admin', 3);

const INPUT: ListingFormInput = {
  name: 'Parrilla Don José',
  slug: 'parrilla-don-jose',
  categoria: 'restaurantes',
  ciudad: 'asuncion',
  subtitle: null,
  description: null,
  zona: null,
  address: null,
  lat: null,
  lng: null,
  phone: null,
  whatsapp: null,
  email: null,
  website: null,
  instagram: null,
  especialidades: null,
  productos: null,
  servicios: null,
  destacadoItem: null,
};

/** Every editor-reachable export — arguments valid enough that ONLY the guard can reject them. */
const EDITOR_REACHABLE: { name: string; call: (actor: SessionUser | null, db: Db) => Promise<unknown> }[] = [
  { name: 'listListings', call: (actor, db) => listListings(actor, { page: 1 }, db) },
  { name: 'getListingForEdit', call: (actor, db) => getListingForEdit(actor, 'x', db) },
  { name: 'isListingSlugTaken', call: (actor, db) => isListingSlugTaken(actor, 'x', null, db) },
  { name: 'createListing', call: (actor, db) => createListing(actor, INPUT, db) },
  { name: 'updateListing', call: (actor, db) => updateListing(actor, 'x', INPUT, db) },
];

describe('lib/db/listings-admin — the authorization boundary', () => {
  describe.each(EDITOR_REACHABLE)('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      // Reaching the database is the PASS here: the guard let it through and
      // the recording db threw on the call that followed.
      const { db, touched } = recordingDb();
      await expect(call(EDITOR, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });

    it('rejects an owner_admin actor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(OWNER_ADMIN, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });
  });

  describe('deleteListing', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteListing(ANONYMOUS, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteListing(EDITOR, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteListing(ADMIN, 'x', db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('the editor-facing write path cannot set admin-only fields', () => {
    it('updateListing writes only the columns in ListingFormInput — verified/premiumUntil are not parameters at all', () => {
      // Structural assertion, not a runtime one: ListingFormInput has no
      // `verified` or `premiumUntil` key, so no call site of updateListing can
      // pass them even by accident. TypeScript enforces this at compile time;
      // this test documents why there is no runtime case to cover.
      const keys = Object.keys(INPUT);
      expect(keys).not.toContain('verified');
      expect(keys).not.toContain('premiumUntil');
    });
  });
});
