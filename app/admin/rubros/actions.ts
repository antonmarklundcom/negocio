'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { revalidatePublic } from '@/lib/admin/revalidate';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { parseCategoryInput } from '@/lib/admin/validation';
import { CATEGORY_ICON_KEYS } from '@/components/icons';
import { createCategory, deleteCategory, isCategorySlugTaken, updateCategory } from '@/lib/db/taxonomy-admin';

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  console.error('[admin/rubros] action failed:', err);
  return 'No pudimos guardar los cambios. Intentá de nuevo.';
}

export async function createCategoryAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseCategoryInput(fd, 'create', CATEGORY_ICON_KEYS);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isCategorySlugTaken(actor, parsed.data.slug!)) {
      return { errors: { slug: 'Ya existe un rubro con esa URL.' } };
    }
    await createCategory(actor, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/rubros');
  revalidatePublic();
  redirect('/admin/rubros');
}

export async function updateCategoryAction(
  slug: string,
  _prev: AdminFormState,
  fd: FormData,
): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseCategoryInput(fd, 'update', CATEGORY_ICON_KEYS);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await updateCategory(actor, slug, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/rubros');
  revalidatePath(`/admin/rubros/${slug}`);
  revalidatePublic();
  redirect('/admin/rubros');
}

export async function deleteCategoryAction(slug: string): Promise<void> {
  const actor = await currentUser();
  try {
    await deleteCategory(actor, slug);
  } catch (err) {
    // A listings-attached rubro refuses with a count (BUILD-SPEC-PR4 §2) —
    // surfaced back on the edit page rather than crashing to the error
    // boundary, since this is an expected outcome, not a bug.
    redirect(`/admin/rubros/${slug}?deleteError=${encodeURIComponent(messageFor(err))}`);
  }
  revalidatePath('/admin/rubros');
  revalidatePublic();
  redirect('/admin/rubros');
}
