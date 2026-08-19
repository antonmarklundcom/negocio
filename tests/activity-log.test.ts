import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import {
  activityEntityTypes,
  buildActivityLogRow,
  listActivity,
} from '@/lib/db/activity-log';

describe('buildActivityLogRow', () => {
  it('drops the before snapshot on a create', () => {
    const row = buildActivityLogRow({
      userId: 1,
      entityType: 'user',
      entityId: '42',
      action: 'create',
      before: { name: 'should not be kept' },
      after: { name: 'Ana' },
    });
    expect(row.beforeJson).toBeNull();
    expect(row.afterJson).toEqual({ name: 'Ana' });
  });

  it('drops the after snapshot on a delete', () => {
    const row = buildActivityLogRow({
      userId: 1,
      entityType: 'listing',
      entityId: 'neg-001',
      action: 'delete',
      before: { name: 'Panadería' },
      after: { name: 'should not be kept' },
    });
    expect(row.beforeJson).toEqual({ name: 'Panadería' });
    expect(row.afterJson).toBeNull();
  });

  it('keeps both on an update and on an archive', () => {
    for (const action of ['update', 'archive'] as const) {
      const row = buildActivityLogRow({
        userId: 3,
        entityType: 'listing',
        entityId: 'neg-002',
        action,
        before: { status: 'a' },
        after: { status: 'b' },
      });
      expect(row.beforeJson).toEqual({ status: 'a' });
      expect(row.afterJson).toEqual({ status: 'b' });
    }
  });

  it('normalises missing snapshots to null rather than undefined', () => {
    const row = buildActivityLogRow({ userId: null, entityType: 'user', entityId: '1', action: 'update' });
    expect(row.beforeJson).toBeNull();
    expect(row.afterJson).toBeNull();
    expect(row.userId).toBeNull();
  });

  /**
   * `entity_id` is a VARCHAR because this schema keys listings on a string id
   * and categories/cities on their slug. An integer column could not log the
   * site's three main entities.
   */
  it('accepts non-numeric entity ids', () => {
    const row = buildActivityLogRow({
      userId: 1,
      entityType: 'category',
      entityId: 'gastronomia',
      action: 'update',
    });
    expect(row.entityId).toBe('gastronomia');
  });
});

describe('listActivity / activityEntityTypes — the readable audit trail (W2-6)', () => {
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

  const anonymous = null;
  const editor: SessionUser = { id: 2, role: 'editor', ownerId: null, mustChangePassword: false };
  const admin: SessionUser = { id: 1, role: 'admin', ownerId: null, mustChangePassword: false };

  it.each([
    { name: 'listActivity', call: (a: SessionUser | null, db: Db) => listActivity(a, {}, db) },
    { name: 'activityEntityTypes', call: (a: SessionUser | null, db: Db) => activityEntityTypes(a, db) },
  ])('$name throws for an anonymous caller AND never reaches the database', async ({ call }) => {
    const { db, touched } = recordingDb();
    await expect(call(anonymous, db)).rejects.toSatisfy(isAuthError);
    expect(touched).toEqual([]);
  });

  it.each([
    { name: 'listActivity', call: (a: SessionUser | null, db: Db) => listActivity(a, {}, db) },
    { name: 'activityEntityTypes', call: (a: SessionUser | null, db: Db) => activityEntityTypes(a, db) },
  ])('$name rejects an editor — the log names who did what', async ({ call }) => {
    const { db, touched } = recordingDb();
    await expect(call(editor, db)).rejects.toSatisfy(isAuthError);
    expect(touched).toEqual([]);
  });

  it('is reachable by an admin', async () => {
    const { db, touched } = recordingDb();
    await expect(listActivity(admin, {}, db)).rejects.toThrow(/the database was reached/);
    expect(touched.length).toBeGreaterThan(0);
  });
});
