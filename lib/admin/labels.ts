import type { ActivityAction, BlockKind, LeadSource, UserStatus } from '@/lib/db/schema';

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

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  listing_message: 'Mensaje desde ficha',
  listing_whatsapp: 'WhatsApp desde ficha',
  sumate: 'Sumate (alta de negocio)',
  contacto: 'Contacto',
};
