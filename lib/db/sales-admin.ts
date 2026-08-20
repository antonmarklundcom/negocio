import 'server-only';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { sales, users, type SaleMethod, type SalePackage } from './schema';

/**
 * Reading the revenue record (ROADMAP W2-3 / D5). Writing it is NOT here: a
 * sale is written inside the same transaction as the package it pays for, in
 * `lib/db/listings-admin.ts`. There is deliberately no `createSale` — a sale
 * that can be recorded on its own is a sale that can disagree with the thing
 * the money bought.
 *
 * Admin-only throughout. An editor sells nothing and, until the `sales` role
 * exists (D4), nobody but an admin has any business reading the books.
 */

export const SALES_PAGE_SIZE = 50;

export interface SaleListRow {
  id: number;
  listingId: string;
  listingName: string;
  packageKind: SalePackage;
  days: number;
  amountGs: number;
  method: SaleMethod;
  sellerName: string | null;
  createdAt: Date;
}

export interface SaleListResult {
  rows: SaleListRow[];
  total: number;
  totalGs: number;
  page: number;
  pageSize: number;
}

const SALE_COLUMNS = {
  id: sales.id,
  listingId: sales.listingId,
  listingName: sales.listingName,
  packageKind: sales.packageKind,
  days: sales.days,
  amountGs: sales.amountGs,
  method: sales.method,
  sellerName: users.name,
  createdAt: sales.createdAt,
} as const;

/**
 * `[start, end)` is computed by the caller (`asuncionMonthRange` /
 * `asuncionMonthRanges` in `lib/hours.ts`) — nothing here calls NOW(), same
 * rule as everywhere else in this codebase.
 */
export async function listSales(
  actor: SessionUser | null,
  params: { range?: { start: Date; end: Date }; page?: number } = {},
  database: Db = getDb(),
): Promise<SaleListResult> {
  requireRole(actor, ['admin']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const where = params.range
    ? and(gte(sales.createdAt, params.range.start), lt(sales.createdAt, params.range.end))
    : undefined;

  const [rows, counted] = await Promise.all([
    database
      .select(SALE_COLUMNS)
      .from(sales)
      .leftJoin(users, eq(users.id, sales.soldBy))
      .where(where)
      .orderBy(desc(sales.id))
      .limit(SALES_PAGE_SIZE)
      .offset((page - 1) * SALES_PAGE_SIZE),
    database
      .select({ total: sql<number>`count(*)`, totalGs: sql<number>`coalesce(sum(${sales.amountGs}), 0)` })
      .from(sales)
      .where(where),
  ]);

  return {
    rows,
    total: Number(counted[0]?.total ?? 0),
    totalGs: Number(counted[0]?.totalGs ?? 0),
    page,
    pageSize: SALES_PAGE_SIZE,
  };
}

export interface SalesMonthTotal {
  monthLabel: string;
  count: number;
  totalGs: number;
}

/**
 * Totals per month, bucketed in JavaScript from ONE query — the same choice
 * `getListingLeadTrend` makes, and for the same reason: grouping by month in
 * SQL means date arithmetic in MySQL's timezone, and this app computes time
 * itself so that never happens.
 */
export async function salesMonthTotals(
  actor: SessionUser | null,
  ranges: { start: Date; end: Date; monthLabel: string }[],
  database: Db = getDb(),
): Promise<SalesMonthTotal[]> {
  requireRole(actor, ['admin']);

  if (ranges.length === 0) return [];

  const from = ranges[0]!.start;
  const to = ranges[ranges.length - 1]!.end;

  const rows = await database
    .select({ amountGs: sales.amountGs, createdAt: sales.createdAt })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lt(sales.createdAt, to)));

  return ranges.map((range) => {
    let count = 0;
    let totalGs = 0;
    for (const row of rows) {
      const at = row.createdAt.getTime();
      if (at < range.start.getTime() || at >= range.end.getTime()) continue;
      count++;
      totalGs += Number(row.amountGs);
    }
    return { monthLabel: range.monthLabel, count, totalGs };
  });
}

/** Every sale in the range, for the CSV export. Same guard as the screen. */
export async function listSalesForExport(
  actor: SessionUser | null,
  range: { start: Date; end: Date } | undefined,
  database: Db = getDb(),
): Promise<SaleListRow[]> {
  requireRole(actor, ['admin']);

  const where = range ? and(gte(sales.createdAt, range.start), lt(sales.createdAt, range.end)) : undefined;

  return database
    .select(SALE_COLUMNS)
    .from(sales)
    .leftJoin(users, eq(users.id, sales.soldBy))
    .where(where)
    .orderBy(desc(sales.id))
    .limit(5000);
}
