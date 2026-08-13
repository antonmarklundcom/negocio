import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import {
  addGalleryImage,
  createListing,
  deleteListing,
  extendListingFeatured,
  extendListingPremium,
  getListingForEdit,
  isListingSlugTaken,
  listListings,
  MAX_FEATURED_SLOTS,
  moveGalleryImage,
  removeGalleryImage,
  removeListingFeatured,
  setCoverImage,
  setListingFlags,
  setListingHours,
  updateGalleryAlt,
  updateListing,
} from '@/lib/db/listings-admin';
import type { ListingFlagsInput, ListingFormInput } from '@/lib/admin/validation';

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

const FLAGS_INPUT: ListingFlagsInput = { verified: true, premiumUntil: null };

/** Every editor-reachable export — arguments valid enough that ONLY the guard can reject them. */
const EDITOR_REACHABLE: { name: string; call: (actor: SessionUser | null, db: Db) => Promise<unknown> }[] = [
  { name: 'listListings', call: (actor, db) => listListings(actor, { page: 1 }, db) },
  { name: 'getListingForEdit', call: (actor, db) => getListingForEdit(actor, 'x', db) },
  { name: 'isListingSlugTaken', call: (actor, db) => isListingSlugTaken(actor, 'x', null, db) },
  { name: 'createListing', call: (actor, db) => createListing(actor, INPUT, db) },
  { name: 'updateListing', call: (actor, db) => updateListing(actor, 'x', INPUT, db) },
  { name: 'setListingHours', call: (actor, db) => setListingHours(actor, 'x', [], db) },
  { name: 'addGalleryImage', call: (actor, db) => addGalleryImage(actor, 'x', 'listings/x/a.webp', null, db) },
  { name: 'updateGalleryAlt', call: (actor, db) => updateGalleryAlt(actor, 'x', 1, null, db) },
  { name: 'moveGalleryImage', call: (actor, db) => moveGalleryImage(actor, 'x', 1, 'up', db) },
  { name: 'removeGalleryImage', call: (actor, db) => removeGalleryImage(actor, 'x', 1, db) },
  { name: 'setCoverImage', call: (actor, db) => setCoverImage(actor, 'x', 'listings/x/a.webp', db) },
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

  describe('setListingFlags', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(setListingFlags(ANONYMOUS, 'x', FLAGS_INPUT, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(setListingFlags(EDITOR, 'x', FLAGS_INPUT, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(setListingFlags(ADMIN, 'x', FLAGS_INPUT, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('extendListingPremium (manual premium sales flow)', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(extendListingPremium(ANONYMOUS, 'x', 30, 1_700_000_000, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(extendListingPremium(EDITOR, 'x', 30, 1_700_000_000, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects a package outside the sold set AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      // @ts-expect-error deliberately invalid — the guard must reject even a
      // value that only bypasses TypeScript, not just the UI's button list.
      await expect(extendListingPremium(ADMIN, 'x', 14, 1_700_000_000, db)).rejects.toThrow(
        /paquete de premium/,
      );
      expect(touched).toEqual([]);
    });

    it('extends from the current expiry when still premium, not from today', async () => {
      const now = 1_700_000_000;
      const currentExpiry = now + 10 * 86400; // still 10 days of premium left
      const { tx, updateCalls } = fakePremiumTx({ verified: false, premiumUntil: currentExpiry });
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await extendListingPremium(ADMIN, 'x', 30, now, db);
      expect(updateCalls()).toEqual([currentExpiry + 30 * 86400]);
    });

    it('extends from today when the current premium already expired', async () => {
      const now = 1_700_000_000;
      const expiredAt = now - 5 * 86400;
      const { tx, updateCalls } = fakePremiumTx({ verified: false, premiumUntil: expiredAt });
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await extendListingPremium(ADMIN, 'x', 30, now, db);
      expect(updateCalls()).toEqual([now + 30 * 86400]);
    });
  });

  describe('extendListingFeatured / removeListingFeatured ("destacado en portada")', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(extendListingFeatured(ANONYMOUS, 'x', 30, 1_700_000_000, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(extendListingFeatured(EDITOR, 'x', 30, 1_700_000_000, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects a package outside the sold set AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      // @ts-expect-error deliberately invalid, same as the premium package test.
      await expect(extendListingFeatured(ADMIN, 'x', 14, 1_700_000_000, db)).rejects.toThrow(/paquete de portada/);
      expect(touched).toEqual([]);
    });

    it('removeListingFeatured rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(removeListingFeatured(EDITOR, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('extends a currently-featured listing from its own expiry, and a renewal does not check the cap', async () => {
      const now = 1_700_000_000;
      const currentExpiry = now + 5 * 86400;
      const { tx, updateCalls } = fakeFeaturedTx({ featuredUntil: currentExpiry }, MAX_FEATURED_SLOTS);

      await extendListingFeatured(ADMIN, 'x', 30, now, tx.asDb());
      expect(updateCalls()).toEqual([currentExpiry + 30 * 86400]);
    });

    it('refuses a NEW slot once the cap is full, and writes nothing', async () => {
      const now = 1_700_000_000;
      const { tx, updateCalls } = fakeFeaturedTx({ featuredUntil: null }, MAX_FEATURED_SLOTS);

      await expect(extendListingFeatured(ADMIN, 'x', 30, now, tx.asDb())).rejects.toThrow(
        new RegExp(`${MAX_FEATURED_SLOTS} negocios destacados`),
      );
      expect(updateCalls()).toEqual([]);
    });

    it('sells a new slot when the cap has room', async () => {
      const now = 1_700_000_000;
      const { tx, updateCalls } = fakeFeaturedTx({ featuredUntil: null }, MAX_FEATURED_SLOTS - 1);

      await extendListingFeatured(ADMIN, 'x', 30, now, tx.asDb());
      expect(updateCalls()).toEqual([now + 30 * 86400]);
    });
  });

  describe('gallery mutations reject a foreign imageId — same error as a non-existent one (ROADMAP rule 5)', () => {
    it('moveGalleryImage changes nothing for an imageId belonging to a different listing', async () => {
      const { tx, writesRecorded } = fakeGalleryTx([{ id: 5, url: 'listings/x/a.webp', alt: null, position: 0 }]);
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await expect(moveGalleryImage(ADMIN, 'x', 999, 'up', db)).rejects.toMatchObject({
        message: 'No encontramos esa foto.',
      });
      expect(writesRecorded()).toBe(false);
    });

    it('removeGalleryImage throws the identical message for a foreign imageId as for one that never existed', async () => {
      const foreign = fakeGalleryTx([{ id: 5, url: 'listings/x/a.webp', alt: null, position: 0 }]);
      const dbForeign = { transaction: (cb: (tx: unknown) => unknown) => cb(foreign.tx) } as unknown as Db;
      const missing = fakeGalleryTx([]);
      const dbMissing = { transaction: (cb: (tx: unknown) => unknown) => cb(missing.tx) } as unknown as Db;

      const [foreignErr, missingErr] = await Promise.all([
        removeGalleryImage(ADMIN, 'x', 999, dbForeign).catch((e) => e),
        removeGalleryImage(ADMIN, 'x', 999, dbMissing).catch((e) => e),
      ]);
      expect(foreignErr.message).toBe(missingErr.message);
      expect(foreign.writesRecorded()).toBe(false);
      expect(missing.writesRecorded()).toBe(false);
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

/**
 * A minimal fake transaction handle for the gallery mutations: `select` always
 * returns the given rows (whatever listingId/imageId the code filters on —
 * this fake does not itself enforce scoping, `lib/db/listings-admin.ts` does),
 * and `delete`/`insert`/`update` just record whether a write happened.
 */
function fakeGalleryTx(rows: { id: number; url: string; alt: string | null; position: number }[]) {
  let wrote = false;

  function chain(result: unknown) {
    const obj: Record<string, unknown> = {
      from: () => obj,
      where: () => obj,
      orderBy: () => obj,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return obj;
  }

  const tx = {
    select: () => chain(rows),
    delete: () => {
      wrote = true;
      return { where: () => Promise.resolve() };
    },
    insert: () => ({
      values: () => {
        wrote = true;
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: () => ({
        where: () => {
          wrote = true;
          return Promise.resolve();
        },
      }),
    }),
  };

  return { tx, writesRecorded: () => wrote };
}

/** A minimal fake transaction handle for `extendListingPremium`, recording the `premiumUntil` value each `update().set()` call is given. */
function fakePremiumTx(existing: { verified: boolean; premiumUntil: number | null }) {
  const updateCalls: (number | null)[] = [];

  function chain(result: unknown) {
    const obj: Record<string, unknown> = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return obj;
  }

  const tx = {
    select: () => chain([existing]),
    update: () => ({
      set: (values: { premiumUntil: number | null }) => {
        updateCalls.push(values.premiumUntil);
        return { where: () => Promise.resolve() };
      },
    }),
    insert: () => ({ values: () => Promise.resolve() }),
  };

  return { tx, updateCalls: () => updateCalls };
}

/**
 * A fake transaction for `extendListingFeatured`: the first `select` returns
 * the target row, and — only when it isn't already featured — the second
 * returns the current count of featured listings (the cap check). `tx.asDb()`
 * wraps it as a fake `Db` whose `transaction()` just invokes the callback.
 */
function fakeFeaturedTx(existing: { featuredUntil: number | null }, featuredCount: number) {
  const updateCalls: (number | null)[] = [];
  let selectCallCount = 0;

  function chain(result: unknown) {
    const obj: Record<string, unknown> = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return obj;
  }

  const tx = {
    select: () => {
      selectCallCount++;
      return selectCallCount === 1 ? chain([existing]) : chain([{ total: featuredCount }]);
    },
    update: () => ({
      set: (values: { featuredUntil: number | null }) => {
        updateCalls.push(values.featuredUntil);
        return { where: () => Promise.resolve() };
      },
    }),
    insert: () => ({ values: () => Promise.resolve() }),
    asDb: () => ({ transaction: (cb: (t: unknown) => unknown) => cb(tx) }) as unknown as Db,
  };

  return { tx, updateCalls: () => updateCalls };
}
