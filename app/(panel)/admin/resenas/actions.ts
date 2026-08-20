'use server';

import { revalidatePath } from 'next/cache';
import { revalidatePublic } from '@/lib/admin/revalidate';
import { redirect } from 'next/navigation';
import { currentUser, type SessionUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { approveReview, rejectReview } from '@/lib/db/reviews-admin';
import { REVIEW_STATUSES, type ReviewStatus } from '@/lib/db/schema';

/**
 * Server actions: call the query module, revalidate, redirect. `requireRole`
 * is NOT called here — `approveReview` / `rejectReview` do it themselves, as
 * their first statement, because a server action is reachable over HTTP
 * without the `/admin` layout ever rendering.
 */

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  console.error('[admin/resenas] action failed:', err);
  return 'No pudimos guardar el cambio. Intentá de nuevo.';
}

/**
 * The return URL is BUILT here from a validated status, never passed in as a
 * path: a redirect target that arrives with the request is an open redirect,
 * and a bound server-action argument still arrives with the request.
 */
function backTo(filter: string | undefined, error?: string): string {
  const status = (REVIEW_STATUSES as readonly string[]).includes(filter ?? '') ? (filter as ReviewStatus) : 'pending';
  const params = new URLSearchParams({ estado: status, ...(error ? { error } : {}) });
  return `/admin/resenas?${params}`;
}

/**
 * `listingSlug` is used only to revalidate the public page a decision changes.
 * It never selects the review — the id does, and the query module reads the
 * listing from the row itself.
 */
async function moderate(
  id: number,
  listingSlug: string,
  filter: string | undefined,
  decide: (actor: SessionUser | null, reviewId: number) => Promise<void>,
): Promise<void> {
  const actor = await currentUser();

  try {
    await decide(actor, id);
  } catch (err) {
    redirect(backTo(filter, messageFor(err)));
  }

  revalidatePath('/admin/resenas');
  // The public side goes through `revalidatePublic()` like every other admin
  // write, NOT through a hand-built `revalidatePath(listingPath(slug))`.
  // That narrow form broke silently when the public site moved under
  // `[locale]` in W3-3 — `/lugar/x` is no longer a route — and an approved
  // review simply never appeared on the listing page. It is the second time a
  // bespoke public-path invalidation has rotted here; there is now one place
  // that knows how public caching works, and this is a caller of it.
  revalidatePublic();
  redirect(backTo(filter));
}

export async function approveReviewAction(id: number, listingSlug: string, filter?: string): Promise<void> {
  return moderate(id, listingSlug, filter, approveReview);
}

export async function rejectReviewAction(id: number, listingSlug: string, filter?: string): Promise<void> {
  return moderate(id, listingSlug, filter, rejectReview);
}
