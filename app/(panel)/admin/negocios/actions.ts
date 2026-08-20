'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { revalidatePublic } from '@/lib/admin/revalidate';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser, type SessionUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import {
  parseHoursInput,
  parseListingInput,
  parsePremiumUntilInput,
  parseListingVerifiedInput,
} from '@/lib/admin/validation';
import { listAllCategoryOptions, listAllCityOptions } from '@/lib/db/taxonomy-admin';
import {
  addGalleryImage,
  createListing,
  deleteListing,
  findDuplicateListings,
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
  setListingPremiumUntil,
  setListingVerified,
  recategoriseListings,
  setListingStatus,
  setListingHours,
  UnknownCategoryError,
  updateGalleryAlt,
  updateListing,
} from '@/lib/db/listings-admin';
import { uploadListingImage } from '@/lib/media/upload';
import type { ListingStatus } from '@/lib/db/schema';
import { parseSaleInput } from '@/lib/admin/validation';

/**
 * Server actions: parse, call the query module, revalidate, redirect. Do NOT
 * call `requireRole` here in place of the query module doing it — this layer
 * only turns thrown errors into a message the form can render.
 */

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  if (err instanceof UnknownCategoryError) return err.message;
  // A failed delete confirmation is the person's own typo, not a bug: say so
  // instead of burying it under the generic "intentá de nuevo".
  if (err instanceof DeleteNotConfirmedError) return err.message;
  console.error('[admin/negocios] action failed:', err);
  return 'No pudimos guardar los cambios. Intentá de nuevo.';
}

/**
 * The ADMIN's taxonomy, not the public site's (ROADMAP W2-6). `getCategories()`
 * / `getCities()` from `lib/listings-repo.ts` return only taxonomy that already
 * has listings, so validating against them rejected every category or city
 * that had just been created — permanently, since it could never gain a
 * listing either. These functions carry `requireRole` themselves.
 */
async function validCategorySlugs(actor: SessionUser | null): Promise<string[]> {
  return (await listAllCategoryOptions(actor)).map((c) => c.value);
}

async function validCitySlugs(actor: SessionUser | null): Promise<string[]> {
  return (await listAllCityOptions(actor)).map((c) => c.value);
}

export async function createListingAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseListingInput(fd, 'create', await validCategorySlugs(actor), await validCitySlugs(actor));
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isListingSlugTaken(actor, parsed.data.slug!, null)) {
      return { errors: { slug: 'Ya existe un negocio con esa URL.' } };
    }

    // Duplicate check (ROADMAP W2-6): a WARNING, never a block. Two real
    // businesses genuinely share a name in one city — franchises, two
    // "Farmacia San Roque" on different corners — so refusing the write would
    // make the admin unable to record reality. But typing a business in twice
    // is the commonest data-quality failure on a directory, and once both rows
    // exist neither is obviously the wrong one.
    //
    // `confirmDuplicate` is the hidden field the warning screen submits back.
    // It is a UX acknowledgement, not a permission: nothing here depends on it
    // being honest, because the worst a forged one does is skip a warning the
    // person would have clicked through anyway.
    if (fd.get('confirmDuplicate') !== '1') {
      const duplicates = await findDuplicateListings(actor, parsed.data.name, parsed.data.ciudad);
      if (duplicates.length > 0) {
        return {
          formError:
            `Ya hay ${duplicates.length === 1 ? 'un negocio' : `${duplicates.length} negocios`} con ese ` +
            `nombre en esa ciudad: ${duplicates.map((d) => `/lugar/${d.slug}`).join(', ')}. ` +
            'Si de verdad es otro negocio, guardá de nuevo para confirmar.',
          hidden: { confirmDuplicate: '1' },
        };
      }
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

  const parsed = parseListingInput(fd, 'update', await validCategorySlugs(actor), await validCitySlugs(actor));
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
// verified (a human assertion) and premiumUntil (a sale) — two forms, two
// actions, two query-module functions (ROADMAP W2-2).
// ---------------------------------------------------------------------------

export async function saveVerifiedAction(id: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseListingVerifiedInput(fd);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await setListingVerified(actor, id, parsed.data.verified);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  return { notice: parsed.data.verified ? 'Marcado como verificado.' : 'Verificación quitada.' };
}

export async function savePremiumUntilAction(
  id: string,
  _prev: AdminFormState,
  fd: FormData,
): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parsePremiumUntilInput(fd);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await setListingPremiumUntil(actor, id, parsed.data.premiumUntil);
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

export async function extendPremiumAction(id: string, days: PremiumPackageDays, fd: FormData): Promise<void> {
  const actor = await currentUser();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // ROADMAP W2-3: amount and method are required inputs on the package form,
  // because a revenue table with half its rows at ₲0 "because the form let me
  // skip it" is worse than no revenue table — it looks like data and reports
  // nonsense.
  const sale = parseSaleInput(fd);
  if (!sale.ok) {
    redirect(`/admin/negocios/${id}?flagsError=${encodeURIComponent(sale.message)}`);
  }

  try {
    await extendListingPremium(actor, id, days, nowSeconds, sale.data);
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

export async function extendFeaturedAction(
  id: string,
  days: FeaturedPackageDays,
  fd: FormData,
): Promise<void> {
  const actor = await currentUser();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const sale = parseSaleInput(fd);
  if (!sale.ok) {
    redirect(`/admin/negocios/${id}?flagsError=${encodeURIComponent(sale.message)}`);
  }

  try {
    await extendListingFeatured(actor, id, days, nowSeconds, sale.data);
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

// ---------------------------------------------------------------------------
// bulk re-categorise (ROADMAP W2-6) — the thing that unblocks deleting a rubro
// ---------------------------------------------------------------------------

export async function recategoriseAction(fd: FormData): Promise<void> {
  const actor = await currentUser();
  const ids = fd.getAll('selected').filter((v): v is string => typeof v === 'string');
  const target = fd.get('bulkCategoria');
  const categoria = typeof target === 'string' ? target : '';

  const back = (message: string) =>
    redirect(`/admin/negocios?${new URLSearchParams({ bulk: message })}`);

  if (ids.length === 0) back('Elegí al menos un negocio.');
  if (!categoria) back('Elegí el rubro de destino.');

  let moved = 0;
  try {
    moved = await recategoriseListings(actor, ids, categoria);
  } catch (err) {
    back(messageFor(err));
  }

  revalidatePath('/admin/negocios');
  revalidatePublic();
  back(
    moved === 0
      ? 'No hubo cambios: esos negocios ya estaban en ese rubro.'
      : `${moved} ${moved === 1 ? 'negocio movido' : 'negocios movidos'}.`,
  );
}

// ---------------------------------------------------------------------------
// lifecycle (ROADMAP W2-1) — its own buttons, never the big edit form, so that
// saving a phone number can never publish a draft or un-archive a business
// that closed.
// ---------------------------------------------------------------------------

export async function setStatusAction(id: string, status: ListingStatus): Promise<void> {
  const actor = await currentUser();

  try {
    await setListingStatus(actor, id, status);
  } catch (err) {
    redirect(`/admin/negocios/${id}?statusError=${encodeURIComponent(messageFor(err))}`);
  }

  revalidatePath('/admin/negocios');
  revalidatePath(`/admin/negocios/${id}`);
  revalidatePublic();
  redirect(`/admin/negocios/${id}`);
}
