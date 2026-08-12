import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AuthError, isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import {
  changeOwnPassword,
  createUser,
  getUser,
  isEmailTaken,
  listUsers,
  resetUserPassword,
  updateUser,
} from '@/lib/db/users';

/**
 * Access tests, invoked DIRECTLY against the query module — not through a page,
 * not through a server action. A server action is reachable over HTTP without
 * the `/admin` layout ever rendering, so this module is the real boundary and
 * this is where it has to be proven.
 *
 * THE CANARY. These do not merely assert "an error came back": on the reference
 * build, that version of this test passed with the guard deleted, because a
 * validation error is also an error. Instead every call is handed a database
 * that RECORDS EVERY ACCESS and throws on use, and each test asserts the
 * database was never touched at all. Delete a `requireRole` and the function
 * reaches the database, `touched` is non-empty, and the test fails.
 *
 * To re-run the canary by hand: comment out the `requireRole` line in any
 * function below and re-run this file. Every test for it must fail.
 */

interface Recorder {
  db: Db;
  touched: string[];
}

/** A database that cannot be used without leaving a trace. */
function recordingDb(): Recorder {
  const touched: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      const name = String(prop);
      // Ignore the promise protocol: `await`ing a value does a `then` lookup.
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

/** Every admin-only export, with arguments valid enough that ONLY the guard can reject them. */
const ADMIN_ONLY: { name: string; call: (actor: SessionUser | null, db: Db) => Promise<unknown> }[] = [
  { name: 'listUsers', call: (actor, db) => listUsers(actor, { page: 1 }, db) },
  { name: 'getUser', call: (actor, db) => getUser(actor, 5, db) },
  { name: 'isEmailTaken', call: (actor, db) => isEmailTaken(actor, 'a@b.com', null, db) },
  {
    name: 'createUser',
    call: (actor, db) => createUser(actor, { email: 'a@b.com', name: 'Ana', role: 'editor' }, db),
  },
  {
    name: 'updateUser',
    call: (actor, db) =>
      updateUser(actor, 5, { email: 'a@b.com', name: 'Ana', role: 'editor', status: 'active' }, db),
  },
  { name: 'resetUserPassword', call: (actor, db) => resetUserPassword(actor, 5, 'una-clave-larga', db) },
];

describe('lib/db/users — the authorization boundary', () => {
  describe.each(ADMIN_ONLY)('$name', ({ call }) => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('throws for an editor AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(call(EDITOR, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('reports the anonymous and forbidden cases distinctly, for the log only', async () => {
      const { db } = recordingDb();
      await expect(call(ANONYMOUS, db)).rejects.toMatchObject({ reason: 'unauthenticated' });
      const second = recordingDb();
      await expect(call(EDITOR, second.db)).rejects.toMatchObject({ reason: 'forbidden' });
    });
  });

  describe('changeOwnPassword', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(changeOwnPassword(ANONYMOUS, 'scrypt$1024$8$1$c2FsdA==$a2V5', db)).rejects.toSatisfy(
        isAuthError,
      );
      expect(touched).toEqual([]);
    });

    it('is open to every signed-in role — it only ever touches the caller\'s own row', async () => {
      // Reaching the database here is the PASS: the guard let it through and the
      // recording db threw on the transaction that followed.
      for (const role of ['admin', 'editor', 'owner_admin', 'owner_editor'] as const) {
        const { db, touched } = recordingDb();
        await expect(changeOwnPassword(session(role), 'scrypt$1024$8$1$c2FsdA==$a2V5', db)).rejects.toThrow(
          /the database was reached/,
        );
        expect(touched).toContain('transaction');
      }
    });
  });

  describe('role assignment', () => {
    it.each(['owner_admin', 'owner_editor'] as const)(
      'refuses to create a %s even for an admin, and writes nothing',
      async (role) => {
        const { db, touched } = recordingDb();
        await expect(createUser(ADMIN, { email: 'a@b.com', name: 'Ana', role }, db)).rejects.toSatisfy(
          isAuthError,
        );
        expect(touched).toEqual([]);
      },
    );

    it('refuses to assign an owner role on update, and writes nothing', async () => {
      const { db, touched } = recordingDb();
      await expect(
        updateUser(ADMIN, 5, { email: 'a@b.com', name: 'Ana', role: 'owner_admin', status: 'active' }, db),
      ).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });
  });

  describe('self-lockout', () => {
    it('refuses to let an admin suspend themselves, and writes nothing', async () => {
      const { db, touched } = recordingDb();
      await expect(
        updateUser(ADMIN, ADMIN.id, { email: 'a@b.com', name: 'Ana', role: 'admin', status: 'suspended' }, db),
      ).rejects.toBeInstanceOf(AuthError);
      expect(touched).toEqual([]);
    });

    it('refuses to let an admin demote themselves, and writes nothing', async () => {
      const { db, touched } = recordingDb();
      await expect(
        updateUser(ADMIN, ADMIN.id, { email: 'a@b.com', name: 'Ana', role: 'editor', status: 'active' }, db),
      ).rejects.toBeInstanceOf(AuthError);
      expect(touched).toEqual([]);
    });

    it('allows an admin to suspend a DIFFERENT admin', async () => {
      // Reaching the database is the pass condition: the guard let it through.
      const { db, touched } = recordingDb();
      await expect(
        updateUser(ADMIN, 99, { email: 'a@b.com', name: 'Otro', role: 'admin', status: 'suspended' }, db),
      ).rejects.toThrow(/the database was reached/);
      expect(touched).toContain('transaction');
    });
  });
});
