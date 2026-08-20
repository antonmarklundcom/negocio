import type { Category } from './types';
import { routing, type Locale } from './i18n/routing';

/**
 * The known category set (rubros). This is the authority used to validate
 * `/[categoria]` params (§4) and to drive the CategoryBlock variant (§6.4).
 * Also seeds the `categories` table (§ Database); slugs must stay stable
 * (they are public URLs).
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

/**
 * Locale-keyed category **labels** (ROADMAP D1 / W3-3).
 *
 * The slugs above are the taxonomy's identity — they are public URLs, they are
 * in the database and in the sitemap, and D1 fixed them as Spanish and
 * canonical. Only the display strings vary by locale, so this is a lookup
 * beside the authority rather than a second copy of it: adding a rubro means
 * adding one row above, and a missing translation falls back to Spanish rather
 * than rendering a slug.
 *
 * Kept here rather than in `messages/*.json` because these labels are data —
 * the same values seed the `categories` table — and because a translator
 * editing the message catalogue should not be able to desynchronise it from
 * `CATEGORIES` without TypeScript noticing.
 */
type Labels = { label: string; labelPlural: string };

export const EN_CATEGORY_LABELS: Record<string, Labels> = {
  restaurantes: { label: 'Restaurant', labelPlural: 'Restaurants & cafés' },
  tiendas: { label: 'Shop', labelPlural: 'Shops & retail' },
  hogar: { label: 'Home service', labelPlural: 'Home services' },
  talleres: { label: 'Workshop', labelPlural: 'Workshops & mechanics' },
  salud: { label: 'Health', labelPlural: 'Health' },
  belleza: { label: 'Beauty', labelPlural: 'Beauty & grooming' },
  profesionales: { label: 'Professional', labelPlural: 'Professionals' },
  ferreterias: { label: 'Hardware store', labelPlural: 'Hardware stores' },
  veterinarias: { label: 'Veterinary clinic', labelPlural: 'Veterinary clinics' },
  tecnologia: { label: 'Technology', labelPlural: 'Technology' },
};

/**
 * Category slugs with no explicit entry for `locale`.
 *
 * Exported so a test can assert it is empty. The fallback in `labelsFor` is
 * deliberately silent — a missing translation renders the Spanish label, which
 * is right at runtime and invisible at review time. This is what makes the
 * omission loud instead: add a rubro, forget its translation, and the suite
 * fails rather than the English site quietly going half-Spanish.
 */
export function untranslatedCategories(locale: Locale): string[] {
  if (locale === routing.defaultLocale) return [];
  return CATEGORIES.filter((c) => !EN_CATEGORY_LABELS[c.slug]).map((c) => c.slug);
}

function labelsFor(slug: string, locale: Locale): Labels | undefined {
  if (locale === routing.defaultLocale) return BY_SLUG.get(slug);
  return EN_CATEGORY_LABELS[slug] ?? BY_SLUG.get(slug);
}

export function categoryLabelFor(slug: string, locale: Locale): string {
  return labelsFor(slug, locale)?.label ?? slug;
}

export function categoryLabelPluralFor(slug: string, locale: Locale): string {
  return labelsFor(slug, locale)?.labelPlural ?? slug;
}
