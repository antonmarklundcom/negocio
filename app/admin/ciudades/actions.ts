'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { parseCityInput } from '@/lib/admin/validation';
import { createCity, deleteCity, isCitySlugTaken, updateCity } from '@/lib/db/taxonomy-admin';

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  console.error('[admin/ciudades] action failed:', err);
  return 'No pudimos guardar los cambios. Intentá de nuevo.';
}

export async function createCityAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseCityInput(fd, 'create');
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isCitySlugTaken(actor, parsed.data.slug!)) {
      return { errors: { slug: 'Ya existe una ciudad con esa URL.' } };
    }
    await createCity(actor, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/ciudades');
  redirect('/admin/ciudades');
}

export async function updateCityAction(slug: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseCityInput(fd, 'update');
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await updateCity(actor, slug, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/ciudades');
  revalidatePath(`/admin/ciudades/${slug}`);
  redirect('/admin/ciudades');
}

export async function deleteCityAction(slug: string): Promise<void> {
  const actor = await currentUser();
  try {
    await deleteCity(actor, slug);
  } catch (err) {
    redirect(`/admin/ciudades/${slug}?deleteError=${encodeURIComponent(messageFor(err))}`);
  }
  revalidatePath('/admin/ciudades');
  redirect('/admin/ciudades');
}
