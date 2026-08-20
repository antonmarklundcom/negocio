import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/listings-repo';

/**
 * Drop the public caches a staff write can invalidate (ROADMAP W1-3).
 *
 * Two things went from "always fresh" to "cached" in W1-3 and both have to be
 * dropped here, or the admin starts lying to the person using it:
 *  - the catalogue cache (categories, cities, the live combo lists),
 *  - the ISR pages: `/lugar/[slug]` and `/`.
 *
 * WHY `revalidatePath('/', 'layout')` AND NOT `('/lugar/[slug]', 'page')`:
 * the narrow form invalidated **nothing**. The dynamic-route form is matched
 * against the app-directory page path, and this route lives inside the
 * `(public)` route group, so `/lugar/[slug]` never matched anything. Measured
 * with the W1-6 admin suite against a real MySQL and a real production build:
 * a listing renamed in the admin kept its old name on the public page on every
 * subsequent request. `('/(public)/lugar/[slug]', 'page')` does match, but
 * serves stale once before regenerating — for a delete that means a business
 * the admin just removed is still served to the next visitor. The layout form
 * takes effect on the very next request. Verified in all three states before
 * choosing this one.
 *
 * The tag call stays: `revalidatePath` and the `unstable_cache` tag store are
 * separate mechanisms, and the catalogue cache was verified to need its own
 * call (rename a city in `/admin/ciudades`, re-open `/admin/negocios/nuevo`,
 * the Ciudad select shows the new label immediately).
 *
 * Staff writes are rare and the pages rebuild on demand, so re-rendering more
 * than strictly necessary is the right trade against ever serving a listing
 * that no longer exists.
 *
 * WHY IT IS NOW `'/(site)/[locale]'` (ROADMAP W3-3):
 * `revalidatePath('/', 'layout')` stopped matching anything the moment the
 * public site moved under `[locale]` — there is no longer a route at `/` — so
 * it became a no-op with exactly the W1-3 signature: staff edits landing in
 * MySQL and never reaching the public page, silently, for the full hour.
 *
 * The form that works is the **app-directory path, route group and all**,
 * which is the same lesson as the paragraph above: `'/es'` and `'/en'` do NOT
 * match (a concrete instance of a dynamic segment is not the route), and
 * `'/[locale]'` without the group does not either. `'/(site)/[locale]'` with
 * `'layout'` covers every locale and everything nested under it in one call.
 *
 * All three forms were tried against a real MySQL and a real production build
 * using the W1-6 admin suite, which is the only thing that can tell them
 * apart — every wrong one fails silently and looks identical to working code.
 *
 * Called from admin server actions, deliberately after the query module has
 * committed: this is cache bookkeeping, never authorization.
 */
export function revalidatePublic(): void {
  // `{ expire: 0 }` is the Next 16 spelling of "drop it now": `revalidateTag`
  // takes a cacheLife profile, and without one the entry may still be served
  // stale to the very person who just edited it.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath('/(site)/[locale]', 'layout');
}
