import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/listings-repo';

/**
 * Drop the public caches a staff write can invalidate (ROADMAP W1-3).
 *
 * Three surfaces went from "always fresh" to "cached" in W1-3 and every one of
 * them has to be dropped together, or the admin starts lying to the person
 * using it:
 *  - the catalogue cache (categories, cities, the live combo lists),
 *  - `/lugar/[slug]`, now ISR — the whole dynamic segment is dropped rather
 *    than one path, because most write paths only know the listing's id,
 *  - the home page, which is ISR'd and shows featured/destacado slots.
 *
 * Called from admin server actions, deliberately after the query module has
 * already committed: this is cache bookkeeping, never authorization. Staff
 * writes are rare enough that over-invalidating is the right trade against
 * ever showing a visitor a listing that no longer exists.
 */
export function revalidatePublic(): void {
  // `{ expire: 0 }` is the Next 16 spelling of "drop it now": `revalidateTag`
  // takes a cacheLife profile, and without one the entry may still be served
  // stale to the very person who just edited it.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath('/lugar/[slug]', 'page');
  revalidatePath('/');
}
