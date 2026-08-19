import type { ActivityAction, BlockKind, LeadSource, ReviewStatus, UserStatus } from '@/lib/db/schema';

/**
 * User-facing labels for enum values. Kept apart from the schema so the
 * database keeps English identifiers while the panel speaks Paraguayan Spanish.
 */

export const ACTION_LABELS: Record<ActivityAction, string> = {
  create: 'creó',
  update: 'modificó',
  delete: 'eliminó',
  archive: 'archivó',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
};

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  food: 'Gastronomía (menú / especialidades)',
  shop: 'Tienda (productos)',
  service: 'Servicio (lista de servicios)',
  default: 'Genérico (sin bloque especial)',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Esperando moderación',
  approved: 'Publicada',
  rejected: 'Rechazada',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  listing_message: 'Mensaje desde ficha',
  listing_whatsapp: 'WhatsApp desde ficha',
  sumate: 'Sumate (alta de negocio)',
  contacto: 'Contacto',
};

/**
 * Entity types as written to `activity_log` (ROADMAP W2-6). Not derived from a
 * schema enum — `entity_type` is a plain varchar, deliberately, so a new slice
 * can log without a migration. Anything unlabelled falls back to its raw value
 * rather than disappearing from the filter.
 */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  listing: 'Negocio',
  listing_hours: 'Horarios',
  listing_gallery: 'Galería',
  category: 'Rubro',
  city: 'Ciudad',
  user: 'Usuario',
  review: 'Reseña',
};

export function entityTypeLabel(type: string): string {
  return ENTITY_TYPE_LABELS[type] ?? type;
}
