import { ResultsSkeleton } from '@/components/Skeletons';

/**
 * A route-level loading boundary is safe HERE and nowhere else in this app
 * (ROADMAP W1-3): `/buscar` never calls `notFound()`. The landing routes and
 * `/lugar/[slug]` do, and a `loading.tsx` flushes the response before the page
 * function runs — which turns every one of those 404s into an HTTP 200 with
 * the not-found UI swapped in client-side. They use an in-page `<Suspense>`
 * instead, placed after the `notFound()` check.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-4 py-8 md:px-8">
      <ResultsSkeleton />
    </div>
  );
}
