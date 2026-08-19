'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { revalidatePublic } from '@/lib/admin/revalidate';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { parseHoursInput, parseListingFlagsInput, parseListingInput } from '@/lib/admin/validation';
import { getCategories, getCities } from '@/lib/listings-repo';
import {
  addGalleryImage,
  createListing,
  deleteListing,
  DeleteNotConfirmedError,
  extendListingFeatured,
  extendListingPremium,
  type FeaturedPackageDays,
  isListingSlugTaken,
  moveGalleryImage,
  type PremiumPackageDays,
  removeGalleryImage,
  removeListingFeatured,
  setCoverImage,
  setListingFlags,
  setListingHours,
  updateGalleryAlt,
  updateListing,
} from '@/lib/db/listings-admin';
import { uploadListingImage } from '@/lib/media/upload';

/**
 * Server actions: parse, call the query module, revalidate, redirect. Do NOT
 * call `requireRole` here in place of the query module doing it — this layer
 * only turns thrown errors into a message the form can render.
 */

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  // A failed delete confirmation is the person's own typo, not a bug: say so
  // instead of burying it under the generic "intentá de nuevo".
  if (err instanceof DeleteNotConfirmedError) return err.message;
  console.error('[admin/negocios] action failed:', err);
  return 'No pudimos guardar los cambios. Intentá de nuevo.';
}

async function validCategorySlugs(): Promise<string[]> {
  return (await getCategories()).map((c) => c.slug);
}

async function validCitySlugs(): Promise<string[]> {
  return (await getCities()).map((c) => c.slug);
}

export async function createListingAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseListingInput(fd, 'create', await validCategorySlugs(), await validCitySlugs());
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isListingSlugTaken(actor, parsed.data.slug!, null)) {
      return { errors: { slug: 'Ya existe un negocio con esa URL.' } };
    }
    await createListing(actor, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/negocios');
  revalidatePublic();
  redirect('/admin/negocios');
}

export async function updateListingAction(id: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseListingInput(fd, 'update', await validCategorySlugs(), await validCitySlugs());
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await updateListing(actor, id, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/negocios');
  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect('/admin/negocios');
}

/**
 * Unlike its siblings this used to have no `try/catch` at all: any thrown
 * error — a forbidden editor, a row already gone, a failed confirmation —
 * crashed to the error boundary and lost the page. It now behaves like every
 * other action here and sends the reason back.
 *
 * `confirm` is the listing's slug, typed back by the person doing it. The
 * comparison happens in the query module, not here: this layer is reachable
 * over HTTP on its own, so a confirmation enforced only in the UI is
 * decoration (Phase B rule 2).
 */
export async function deleteListingAction(id: string, fd: FormData): Promise<void> {
  const actor = await currentUser();
  const raw = fd.get('confirm');
  const confirmSlug = typeof raw === 'string' ? raw : '';

  try {
    await deleteListing(actor, id, confirmSlug);
  } catch (err) {
    redirect(`/admin/negocios/${id}?deleteError=${encodeURIComponent(messageFor(err))}`);
  }

  revalidatePath('/admin/negocios');
  revalidatePublic();
  redirect('/admin/negocios');
}

// ---------------------------------------------------------------------------
// hours (BUILD-SPEC-PR5 §1)
// ---------------------------------------------------------------------------

export async function saveHoursAction(id: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseHoursInput(fd);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await setListingHours(actor, id, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  return { notice: 'Horarios guardados.' };
}

// ---------------------------------------------------------------------------
// verified / premiumUntil (BUILD-SPEC-PR5 §3)
// ---------------------------------------------------------------------------

export async function saveFlagsAction(id: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseListingFlagsInput(fd);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await setListingFlags(actor, id, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  return { notice: 'Guardado.' };
}

// ---------------------------------------------------------------------------
// manual premium sales flow (ROADMAP Phase D item 2)
// ---------------------------------------------------------------------------

export async function extendPremiumAction(id: string, days: PremiumPackageDays): Promise<void> {
  const actor = await currentUser();
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await extendListingPremium(actor, id, days, nowSeconds);
  } catch (err) {
    redirect(`/admin/negocios/${id}?flagsError=${encodeURIComponent(messageFor(err))}`);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

// ---------------------------------------------------------------------------
// "destacado en portada" — home-page featured slots (ROADMAP Phase D item 3)
// ---------------------------------------------------------------------------

export async function extendFeaturedAction(id: string, days: FeaturedPackageDays): Promise<void> {
  const actor = await currentUser();
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await extendListingFeatured(actor, id, days, nowSeconds);
  } catch (err) {
    redirect(`/admin/negocios/${id}?flagsError=${encodeURIComponent(messageFor(err))}`);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

export async function removeFeaturedAction(id: string): Promise<void> {
  const actor = await currentUser();

  try {
    await removeListingFeatured(actor, id);
  } catch (err) {
    redirect(`/admin/negocios/${id}?flagsError=${encodeURIComponent(messageFor(err))}`);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

// ---------------------------------------------------------------------------
// gallery (BUILD-SPEC-PR5 §2) — plain server actions, no client component.
// Errors redirect back with a query-string notice rather than crashing to the
// error boundary, since "already at 12 photos" / "storage not configured" are
// expected outcomes, not bugs.
// ---------------------------------------------------------------------------

function withGalleryError(id: string, err: unknown): never {
  redirect(`/admin/negocios/${id}?galleryError=${encodeURIComponent(messageFor(err))}`);
}

export async function uploadGalleryImageAction(id: string, fd: FormData): Promise<void> {
  const actor = await currentUser();
  const file = fd.get('file');

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/negocios/${id}?galleryError=${encodeURIComponent('Elegí una foto para subir.')}`);
  }

  try {
    const key = await uploadListingImage(id, file as File);
    await addGalleryImage(actor, id, key, null);
  } catch (err) {
    withGalleryError(id, err);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

export async function updateGalleryAltAction(id: string, imageId: number, fd: FormData): Promise<void> {
  const actor = await currentUser();
  const raw = fd.get('alt');
  const alt = typeof raw === 'string' && raw.trim() ? raw.trim() : null;

  try {
    await updateGalleryAlt(actor, id, imageId, alt, undefined);
  } catch (err) {
    withGalleryError(id, err);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

export async function moveGalleryImageAction(id: string, imageId: number, dir: 'up' | 'down'): Promise<void> {
  const actor = await currentUser();

  try {
    await moveGalleryImage(actor, id, imageId, dir);
  } catch (err) {
    withGalleryError(id, err);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

export async function removeGalleryImageAction(id: string, imageId: number): Promise<void> {
  const actor = await currentUser();

  try {
    await removeGalleryImage(actor, id, imageId);
  } catch (err) {
    withGalleryError(id, err);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}

export async function setCoverImageAction(id: string, key: string): Promise<void> {
  const actor = await currentUser();

  try {
    await setCoverImage(actor, id, key);
  } catch (err) {
    withGalleryError(id, err);
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}
