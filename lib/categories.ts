import type { Category } from './types';

/**
 * The known category set (rubros). This is the authority used to validate
 * `/[categoria]` params (§4) and to drive the CategoryBlock variant (§6.4).
 * When the backend goes live these labels can be reconciled with JetEngine
 * taxonomy terms, but slugs must stay stable (they are public URLs).
 */
export const CATEGORIES: Category[] = [
  { slug: 'restaurantes', label: 'Restaurante', labelPlural: 'Restaurantes y cafés', icon: 'utensils', blockKind: 'food' },
  { slug: 'tiendas', label: 'Tienda', labelPlural: 'Tiendas y comercios', icon: 'bag', blockKind: 'shop' },
  { slug: 'hogar', label: 'Servicio para el hogar', labelPlural: 'Servicios para el hogar', icon: 'home', blockKind: 'service' },
  { slug: 'talleres', label: 'Taller', labelPlural: 'Talleres y mecánica', icon: 'wrench', blockKind: 'service' },
  { slug: 'salud', label: 'Salud', labelPlural: 'Salud', icon: 'heart', blockKind: 'service' },
  { slug: 'belleza', label: 'Belleza y estética', labelPlural: 'Belleza y estética', icon: 'scissors', blockKind: 'service' },
  { slug: 'profesionales', label: 'Profesional', labelPlural: 'Profesionales', icon: 'briefcase', blockKind: 'service' },
  { slug: 'ferreterias', label: 'Ferretería', labelPlural: 'Ferreterías', icon: 'hammer', blockKind: 'shop' },
  { slug: 'veterinarias', label: 'Veterinaria', labelPlural: 'Veterinarias', icon: 'paw', blockKind: 'service' },
  { slug: 'tecnologia', label: 'Tecnología', labelPlural: 'Tecnología', icon: 'laptop', blockKind: 'shop' },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string): Category | undefined {
  return BY_SLUG.get(slug);
}

export function isKnownCategory(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function categoryLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

export function categoryLabelPlural(slug: string): string {
  return BY_SLUG.get(slug)?.labelPlural ?? slug;
}

export function categoryBlockKind(slug: string): Category['blockKind'] {
  return BY_SLUG.get(slug)?.blockKind ?? 'default';
}
