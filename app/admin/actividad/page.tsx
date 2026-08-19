import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import {
  ACTIVITY_PAGE_SIZE,
  activityEntityTypes,
  listActivity,
} from '@/lib/db/activity-log';
import { ACTIVITY_ACTIONS, type ActivityAction } from '@/lib/db/schema';
import { ACTION_LABELS, entityTypeLabel } from '@/lib/admin/labels';

/**
 * The readable audit trail (ROADMAP W2-6).
 *
 * `activity_log` has been written faithfully since PR-3 — every mutation, in
 * the same transaction as the write — and until now the only way to read any
 * of it was the ten most recent rows on the dashboard. This page is the rest
 * of it: filter by entity type, by a specific entity, by action, and page
 * through.
 *
 * Admin-only. `listActivity` enforces that itself; this page turns the throw
 * into a 404, the same answer the rest of the panel gives.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Actividad' };

function one(params: Record<string, string | string[] | undefined>, key: string): string {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default async function ActivityPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const entityType = one(searchParams, 'entityType');
  const entityId = one(searchParams, 'entityId');
  const rawAction = one(searchParams, 'action');
  const action = (ACTIVITY_ACTIONS as readonly string[]).includes(rawAction)
    ? (rawAction as ActivityAction)
    : undefined;
  const page = Math.max(1, parseInt(one(searchParams, 'page') || '1', 10) || 1);

  const actor = await currentUser();
  let result;
  let types;
  try {
    [result, types] = await Promise.all([
      listActivity(actor, { entityType: entityType || undefined, entityId: entityId || undefined, action, page }),
      activityEntityTypes(actor),
    ]);
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / ACTIVITY_PAGE_SIZE));
  const filters = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(action ? { action } : {}),
  };
  const pageHref = (p: number) =>
    `/admin/actividad?${new URLSearchParams({ ...filters, page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] font-semibold">Actividad</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Cada cambio hecho desde el panel, con quién lo hizo y cuándo. No se puede editar.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap gap-2">
        <select
          name="entityType"
          defaultValue={entityType}
          aria-label="Filtrar por tipo"
          className="rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Todo</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {entityTypeLabel(t)}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={action ?? ''}
          aria-label="Filtrar por acción"
          className="rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Toda acción</option>
          {ACTIVITY_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="entityId"
          defaultValue={entityId}
          placeholder="ID o slug exacto"
          aria-label="Filtrar por entidad"
          className="min-w-[200px] flex-1 rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Filtrar
        </button>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-card border border-line bg-white px-4 py-8 text-center text-[15px] text-ink2">
          No hay actividad que coincida con ese filtro.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  {['Cuándo', 'Quién', 'Qué', 'Entidad'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-ink2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line2 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-ink2">
                      {row.createdAt.toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}
                    </td>
                    {/* A deleted user leaves their entries behind — the log
                        outlives the account, and "—" is honest about that. */}
                    <td className="px-4 py-3">{row.actorName ?? '—'}</td>
                    <td className="px-4 py-3">
                      {ACTION_LABELS[row.action]} {entityTypeLabel(row.entityType).toLowerCase()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/actividad?${new URLSearchParams({ entityType: row.entityType, entityId: row.entityId })}`}
                        className="font-mono text-[12px] text-blue hover:underline"
                      >
                        {row.entityId}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-[14px]">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="font-bold text-blue hover:underline">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink2">
                Página {result.page} de {totalPages} · {result.total} registros
              </span>
              {result.page < totalPages ? (
                <Link href={pageHref(result.page + 1)} className="font-bold text-blue hover:underline">
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
