import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, dbConfigured } from './client';
import { leads, type LeadInsert } from './schema';

/**
 * Lead persistence (§ Database, ROADMAP Phase D item 1's prerequisite). Called
 * from `lib/leads.ts` BEFORE the webhook fan-out, so a lead survives a dead
 * webhook. Both functions are best-effort: `dbConfigured()` guards local dev
 * (no `DATABASE_URL`, nothing to persist), and any thrown DB error is left for
 * the caller to catch — a lead write must never fail the visitor's request.
 */

export type NewLead = Omit<LeadInsert, 'id' | 'createdAt' | 'deliveredSinks' | 'configuredSinks'>;

/** Insert a lead row. Returns its id, or `undefined` when no database is configured. */
export async function insertLead(row: NewLead): Promise<number | undefined> {
  if (!dbConfigured()) return undefined;
  const db = getDb();
  const [result] = await db.insert(leads).values(row);
  return result.insertId;
}

/** Record how many sinks accepted the lead, once the fan-out has settled. */
export async function updateLeadDelivery(
  id: number,
  delivered: number,
  configured: number,
): Promise<void> {
  if (!dbConfigured()) return;
  const db = getDb();
  await db.update(leads).set({ deliveredSinks: delivered, configuredSinks: configured }).where(eq(leads.id, id));
}
