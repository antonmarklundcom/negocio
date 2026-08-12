import type { ActivityAction, UserStatus } from '@/lib/db/schema';

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
