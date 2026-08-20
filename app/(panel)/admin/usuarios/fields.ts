import type { FieldDef } from '@/components/admin/AdminForm';
import { STAFF_ROLES, USER_STATUSES } from '@/lib/db/schema';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { STATUS_LABELS } from '@/lib/admin/labels';

/**
 * The form, as data. An entity gains a form by writing this list — not by
 * writing a form component.
 *
 * Note what is ABSENT and therefore unsettable from any screen: the password
 * hash (issued only as a one-time reset), `mustChangePassword` (set by the
 * system, cleared by the user), and the owner roles (reserved for PR-6). That
 * absence IS the enforcement; disabling an input in the UI is not.
 */
export function userFields(mode: 'create' | 'update'): FieldDef[] {
  const fields: FieldDef[] = [
    { type: 'text', name: 'name', label: 'Nombre', required: true, maxLength: 120, autoComplete: 'off' },
    { type: 'email', name: 'email', label: 'Correo', required: true, maxLength: 160, autoComplete: 'off' },
    {
      type: 'select',
      name: 'role',
      label: 'Rol',
      required: true,
      placeholder: '— Elegí un rol —',
      options: STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
      hint: 'Editor: negocios, rubros y ciudades. Administrador: además, usuarios.',
    },
  ];

  if (mode === 'update') {
    fields.push({
      type: 'select',
      name: 'status',
      label: 'Estado',
      required: true,
      placeholder: '— Elegí un estado —',
      options: USER_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
      hint: 'Una cuenta suspendida no puede iniciar sesión. El cambio corre en el próximo pedido.',
    });
  }

  return fields;
}
