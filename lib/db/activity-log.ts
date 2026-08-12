import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { activityLog, users, type ActivityAction, type ActivityLogInsert } from './schema';

/**
 * The audit trail.
 *
 * `logActivity` is called from INSIDE the same transaction as the mutation it
 * records, never from a route — so a write cannot succeed while its log entry
 * fails, and a new entity cannot ship without an audit trail by simply
 * forgetting a line in a route handler.
 *
 * `buildActivityLogRow` is pure and therefore unit-testable without MySQL,
 * which is where the create ⇒ `before:null` / delete ⇒ `after:null` invariants
 * are actually asserted.
 */

/**
 * Structural, not `Db`: mutations call this from inside `db.transaction`, and
 * Drizzle's transaction handle is not assignable to `Db` even though its
 * `.insert` is identical.
 */
export type Writable = Pick<Db, 'insert'>;

export interface ActivityLogEntry {
  userId: number | null;
  entityType: string;
  /** A string because `listings.id`, `categories.slug` and `cities.slug` are strings. */
  entityId: string;
  action: ActivityAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Pure. A `create` has no before, a `delete` has no after, an `update` has both.
 * Passing the wrong one is a mistake this normalisation makes impossible.
 *
 * NEVER pass a `users` row through here — snapshots must not contain
 * `password_hash`. `lib/db/users.ts` redacts before calling.
 */
export function buildActivityLogRow(entry: ActivityLogEntry): ActivityLogInsert {
  const before = entry.action === 'create' ? null : (entry.before ?? null);
  const after = entry.action === 'delete' ? null : (entry.after ?? null);
  return {
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    beforeJson: before,
    afterJson: after,
  };
}

export async function logActivity(db: Writable, entry: ActivityLogEntry): Promise<void> {
  await db.insert(activityLog).values(buildActivityLogRow(entry));
}

export interface ActivityLogListRow {
  id: number;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: ActivityAction;
  createdAt: Date;
}

/**
 * Most recent entries first. Read-only: the log is never edited through the UI.
 * A leaked read is still a leak, so this is guarded like any mutation — and
 * admin-only, because the log names who did what.
 */
export async function recentActivity(
  actor: SessionUser | null,
  limit = 50,
  database: Db = getDb(),
): Promise<ActivityLogListRow[]> {
  requireRole(actor, ['admin']);

  const rows = await database
    .select({
      id: activityLog.id,
      actorName: users.name,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      action: activityLog.action,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId))
    .orderBy(desc(activityLog.id))
    .limit(limit);
  return rows;
}
