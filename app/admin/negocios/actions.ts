'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { parseListingInput } from '@/lib/admin/validation';
import { getCategories, getCities } from '@/lib/listings-repo';
import {
  createListing,
  deleteListing,
  isListingSlugTaken,
  updateListing,
} from '@/lib/db/listings-admin';

/**
 * Server actions: parse, call the query module, revalidate, redirect. Do NOT
 * call `requireRole` here in place of the query module doing it — this layer
 * only turns thrown errors into a message the form can render.
 */

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
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
  redirect('/admin/negocios');
}

export async function deleteListingAction(id: string): Promise<void> {
  const actor = await currentUser();
  await deleteListing(actor, id);
  revalidatePath('/admin/negocios');
  redirect('/admin/negocios');
}
