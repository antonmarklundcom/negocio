import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import {
  createCategory,
  createCity,
  deleteCategory,
  deleteCity,
  getCategory,
  getCityAdmin,
  isCategorySlugTaken,
  isCitySlugTaken,
  listCategories,
  listCities,
  updateCategory,
  updateCity,
  type AdminCategoryRow,
  type AdminCityRow,
  listAllCategoryOptions,
  listAllCityOptions,
} from '@/lib/db/taxonomy-admin';
import type { CategoryFormInput, CityFormInput } from '@/lib/admin/validation';

/**
 * Access tests for categories (rubros) and cities (ciudades), mirroring
 * `tests/users-access.test.ts` and `tests/listings-admin-access.test.ts`.
 *
 * CANARY: comment out any `requireRole` line in `lib/db/taxonomy-admin.ts` and
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

const CATEGORY_INPUT: CategoryFormInput = {
  slug: 'mascotas',
  label: 'Mascotas',
  labelPlural: 'Tiendas de mascotas',
  icon: 'bag',
  blockKind: 'shop',
  sortOrder: 3,
};

const CITY_INPUT: CityFormInput = { slug: 'aregua', label: 'Areguá', sortOrder: 9, lat: null, lng: null };

const EDITOR_REACHABLE_CATEGORY: { name: string; call: (actor: SessionUser | null, db: Db) => Promise<unknown> }[] = [
  { name: 'listCategories', call: (actor, db) => listCategories(actor, { page: 1 }, db) },
  { name: 'getCategory', call: (actor, db) => getCategory(actor, 'x', db) },
  { name: 'isCategorySlugTaken', call: (actor, db) => isCategorySlugTaken(actor, 'x', db) },
  { name: 'createCategory', call: (actor, db) => createCategory(actor, CATEGORY_INPUT, db) },
  { name: 'updateCategory', call: (actor, db) => updateCategory(actor, 'x', CATEGORY_INPUT, db) },
];

const EDITOR_REACHABLE_CITY: { name: string; call: (actor: SessionUser | null, db: Db) => Promise<unknown> }[] = [
  { name: 'listCities', call: (actor, db) => listCities(actor, { page: 1 }, db) },
  { name: 'getCityAdmin', call: (actor, db) => getCityAdmin(actor, 'x', db) },
  { name: 'isCitySlugTaken', call: (actor, db) => isCitySlugTaken(actor, 'x', db) },
  { name: 'createCity', call: (actor, db) => createCity(actor, CITY_INPUT, db) },
  { name: 'updateCity', call: (actor, db) => updateCity(actor, 'x', CITY_INPUT, db) },
];

describe('lib/db/taxonomy-admin — categories', () => {
  describe.each(EDITOR_REACHABLE_CATEGORY)('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
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

  describe('deleteCategory', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteCategory(ANONYMOUS, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteCategory(EDITOR, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('refuses to delete a category with listings attached, and writes nothing', async () => {
      const row: AdminCategoryRow = {
        slug: 'restaurantes',
        label: 'Restaurante',
        labelPlural: 'Restaurantes',
        icon: 'utensils',
        blockKind: 'food',
        sortOrder: 0,
      };
      const { tx, deleteCalled } = fakeDeleteTx(row, 3);
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await expect(deleteCategory(ADMIN, 'restaurantes', db)).rejects.toMatchObject({
        message: expect.stringContaining('3 negocios'),
      });
      expect(deleteCalled()).toBe(false);
    });

    it('deletes a category with no listings attached', async () => {
      const row: AdminCategoryRow = {
        slug: 'mascotas',
        label: 'Mascotas',
        labelPlural: 'Tiendas de mascotas',
        icon: 'bag',
        blockKind: 'shop',
        sortOrder: 3,
      };
      const { tx, deleteCalled } = fakeDeleteTx(row, 0);
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await deleteCategory(ADMIN, 'mascotas', db);
      expect(deleteCalled()).toBe(true);
    });
  });
});

describe('lib/db/taxonomy-admin — cities', () => {
  describe.each(EDITOR_REACHABLE_CITY)('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(call(EDITOR, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('deleteCity', () => {
    it('rejects an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(deleteCity(EDITOR, 'x', db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('refuses to delete a city with listings attached, and writes nothing', async () => {
      const row: AdminCityRow = { slug: 'asuncion', label: 'Asunción', sortOrder: 0, lat: null, lng: null };
      const { tx, deleteCalled } = fakeDeleteTx(row, 12);
      const db = { transaction: (cb: (tx: unknown) => unknown) => cb(tx) } as unknown as Db;

      await expect(deleteCity(ADMIN, 'asuncion', db)).rejects.toMatchObject({
        message: expect.stringContaining('12 negocios'),
      });
      expect(deleteCalled()).toBe(false);
    });
  });
});

/**
 * A minimal fake transaction handle for `deleteCategory`/`deleteCity`: the
 * first `select` returns the existing row, the second returns the listing
 * count, and `delete` just records whether it was called. Every chain method
 * (`from`/`where`/`limit`/`groupBy`) returns the same thenable object, so the
 * fake works regardless of exactly which methods a given query chains.
 */
function fakeDeleteTx(existingRow: AdminCategoryRow | AdminCityRow, listingCount: number) {
  let deleteCalled = false;
  let selectCallCount = 0;

  function chain(result: unknown[]) {
    const obj: Record<string, unknown> = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      groupBy: () => obj,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return obj;
  }

  const tx = {
    select: () => {
      selectCallCount++;
      return selectCallCount === 1 ? chain([existingRow]) : chain([{ total: listingCount }]);
    },
    delete: () => {
      deleteCalled = true;
      return { where: () => Promise.resolve() };
    },
    insert: () => ({ values: () => Promise.resolve() }),
  };

  return { tx, deleteCalled: () => deleteCalled };
}

describe('lib/db/taxonomy-admin — the admin unfiltered reads (W2-6)', () => {
  // These exist because the admin was reading `getCategories()`/`getCities()`
  // from `lib/listings-repo.ts`, which return only taxonomy that ALREADY has
  // listings. A category or city created in the admin was therefore absent
  // from the new-listing select and rejected by the create validation — so it
  // could never gain a listing, so it never became selectable. Found by the
  // W1-6 admin e2e suite.
  describe.each([
    { name: 'listAllCategoryOptions', call: (actor: SessionUser | null, db: Db) => listAllCategoryOptions(actor, db) },
    { name: 'listAllCityOptions', call: (actor: SessionUser | null, db: Db) => listAllCityOptions(actor, db) },
  ])('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor — an editor creates listings and needs the options', async () => {
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
});
