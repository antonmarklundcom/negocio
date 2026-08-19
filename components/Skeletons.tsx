/**
 * Loading skeletons for the DB-backed public routes (ROADMAP W1-3).
 *
 * These exist so a slow MySQL read shows the page's shape instead of a blank
 * viewport — the pool is capped at 8 connections (`lib/db/connection.ts`), so
 * "slow" is a real state under load, not a theoretical one.
 *
 * `role="status"` + `sr-only` text: a screen reader should hear "Cargando",
 * not read out a wall of empty boxes, which is what the `aria-hidden` blocks
 * are for.
 */

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-card bg-line2 ${className}`} aria-hidden />;
}

/**
 * The results half of a landing page: filter row + card grid. No heading — on
 * the landing routes the heading is real content that has already rendered
 * above the Suspense boundary.
 */
export function ResultsSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando negocios…</span>
      <Block className="h-12 w-full" />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Block key={i} className="h-52" />
        ))}
      </div>
    </div>
  );
}
