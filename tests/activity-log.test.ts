import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildActivityLogRow } from '@/lib/db/activity-log';

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
