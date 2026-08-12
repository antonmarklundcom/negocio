import 'server-only';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { leads, type LeadSource } from './schema';

/**
 * Leads, read-only. No create, no update, no delete through this module — the
 * write path is `lib/db/leads.ts`, called from the public lead orchestrator,
 * not from the admin.
 *
 * Guarded `['admin']` only: a lead row carries a member of the public's name,
 * phone and email, and the editor role today is "content", not "customer
 * data" (BUILD-SPEC-PR4 open question 1).
 */

export const LEADS_PAGE_SIZE = 50;

export interface LeadRow {
  id: number;
  source: LeadSource;
  createdAt: Date;
  name: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  listingId: string | null;
  listingSlug: string | null;
  message: string | null;
  businessName: string | null;
  category: string | null;
  city: string | null;
  deliveredSinks: number | null;
  configuredSinks: number | null;
}

export interface LeadListResult {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listLeads(
  actor: SessionUser | null,
  params: { source?: string; q?: string; page?: number } = {},
  database: Db = getDb(),
): Promise<LeadListResult> {
  requireRole(actor, ['admin']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';

  const conditions = [];
  if (params.source) conditions.push(eq(leads.source, params.source as LeadSource));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(leads.name, pattern),
        like(leads.contact, pattern),
        like(leads.email, pattern),
        like(leads.phone, pattern),
        like(leads.businessName, pattern),
      ),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await database
    .select()
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(LEADS_PAGE_SIZE)
    .offset((page - 1) * LEADS_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(leads)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: LEADS_PAGE_SIZE };
}

/** For the dashboard stat tile. `since` is a unix-seconds cutoff, computed by the caller — nothing here calls NOW(). */
export async function countLeadsSince(actor: SessionUser | null, since: Date, database: Db = getDb()): Promise<number> {
  requireRole(actor, ['admin']);
  const [row] = await database
    .select({ total: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.createdAt} >= ${since}`);
  return Number(row?.total ?? 0);
}
