import type { City } from './types';

/** Real Paraguayan cities used across the seed dataset. */
export const CITIES: City[] = [
  { slug: 'asuncion', label: 'Asunción' },
  { slug: 'san-lorenzo', label: 'San Lorenzo' },
  { slug: 'luque', label: 'Luque' },
  { slug: 'capiata', label: 'Capiatá' },
  { slug: 'ciudad-del-este', label: 'Ciudad del Este' },
  { slug: 'encarnacion', label: 'Encarnación' },
  { slug: 'lambare', label: 'Lambaré' },
  { slug: 'fernando-de-la-mora', label: 'Fernando de la Mora' },
];

const BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

export function cityLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

export function isKnownCity(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** Approximate city-centre coordinates, for seed map pins. */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  asuncion: { lat: -25.2867, lng: -57.3333 },
  'san-lorenzo': { lat: -25.3397, lng: -57.5089 },
  luque: { lat: -25.2667, lng: -57.4833 },
  capiata: { lat: -25.355, lng: -57.4456 },
  'ciudad-del-este': { lat: -25.5097, lng: -54.6111 },
  encarnacion: { lat: -27.3306, lng: -55.8667 },
  lambare: { lat: -25.35, lng: -57.6167 },
  'fernando-de-la-mora': { lat: -25.3333, lng: -57.5333 },
};

/**
 * City labels do **not** vary by locale (ROADMAP D1 / W3-3).
 *
 * "Asunción" is Asunción in English. Providing an English lookup here would be
 * an invitation to fill it with mistranslations of proper nouns, so the
 * locale-aware accessor exists — so callers do not have to special-case the
 * taxonomy — and deliberately ignores its argument.
 */
export function cityLabelFor(slug: string, _locale: unknown): string {
  return cityLabel(slug);
}
