import type { FieldDef } from '@/components/admin/AdminForm';
import type { DayHours } from '@/lib/types';
import { formatPremiumUntilDate } from '@/lib/admin/validation';

/**
 * The form, as data — same shape as `usuarios`. The taxonomy options are
 * passed in, not imported from `lib/categories.ts` / `lib/cities.ts`: the form
 * must offer what is in the DATABASE, or an editor can pick a rubro that no
 * longer exists and the FK rejects the insert with a 500.
 *
 * Absent on purpose, and that absence IS the enforcement: `verified`,
 * `premiumUntil`, `rating`, `reviewsCount`, `yearsActive`, `avgResponseMins`,
 * `coverImage`, gallery, hours. The first two are PR-5's, behind `admin`.
 * `rating`/`reviewsCount` are never free-text admin fields at all — the whole
 * reviews UI is honesty-gated (ROADMAP rule 8).
 */
export function listingFields(
  mode: 'create' | 'update',
  categories: { value: string; label: string }[],
  cities: { value: string; label: string }[],
): FieldDef[] {
  const fields: FieldDef[] = [
    { type: 'text', name: 'name', label: 'Nombre', required: true, maxLength: 200 },
  ];

  if (mode === 'create') {
    fields.push({
      type: 'text',
      name: 'slug',
      label: 'URL (slug)',
      required: true,
      maxLength: 191,
      hint: 'Minúsculas, números y guiones. Ej. "parrilla-don-jose". No se puede cambiar después.',
    });
  }

  fields.push(
    {
      type: 'select',
      name: 'categoria',
      label: 'Rubro',
      required: true,
      placeholder: '— Elegí un rubro —',
      options: categories,
    },
    {
      type: 'select',
      name: 'ciudad',
      label: 'Ciudad',
      required: true,
      placeholder: '— Elegí una ciudad —',
      options: cities,
    },
    { type: 'text', name: 'subtitle', label: 'Subtítulo', maxLength: 200, hint: 'Ej. "Cocina paraguaya"' },
    { type: 'textarea', name: 'description', label: 'Descripción', rows: 6, maxLength: 2000 },
    { type: 'text', name: 'zona', label: 'Zona', maxLength: 120, hint: 'Barrio. Ej. "Villa Morra"' },
    { type: 'text', name: 'address', label: 'Dirección', maxLength: 255 },
    {
      type: 'text',
      name: 'lat',
      label: 'Latitud',
      hint: 'Opcional. Poné las dos coordenadas o ninguna. Ej. -25,29 o -25.29',
    },
    { type: 'text', name: 'lng', label: 'Longitud', hint: 'Opcional. Poné las dos coordenadas o ninguna.' },
    { type: 'text', name: 'phone', label: 'Teléfono', maxLength: 40 },
    {
      type: 'text',
      name: 'whatsapp',
      label: 'WhatsApp',
      maxLength: 20,
      hint: 'Solo dígitos, con código de país: 595981123456',
    },
    { type: 'email', name: 'email', label: 'Correo', maxLength: 160 },
    { type: 'url', name: 'website', label: 'Sitio web', maxLength: 255 },
    {
      type: 'text',
      name: 'instagram',
      label: 'Instagram',
      maxLength: 80,
      hint: 'Solo el usuario, sin @ ni URL',
    },
    {
      type: 'textarea',
      name: 'especialidades',
      label: 'Especialidades',
      rows: 4,
      maxLength: 1000,
      hint: 'Una por línea. Ej.\nEmpanadas\nMilanesas',
    },
    {
      type: 'textarea',
      name: 'productos',
      label: 'Productos',
      rows: 5,
      maxLength: 2000,
      hint: 'Uno por línea: Título | precio (precio opcional). Ej.\nRemera | Gs. 80.000',
    },
    {
      type: 'textarea',
      name: 'servicios',
      label: 'Servicios',
      rows: 5,
      maxLength: 2000,
      hint: 'Uno por línea: Título | descripción (descripción opcional).',
    },
    { type: 'text', name: 'destacadoTitle', label: 'Destacado — título', maxLength: 120 },
    { type: 'textarea', name: 'destacadoDesc', label: 'Destacado — descripción', rows: 3, maxLength: 400 },
    { type: 'text', name: 'destacadoPrice', label: 'Destacado — precio', maxLength: 60 },
  );

  return fields;
}

// ---------------------------------------------------------------------------
// hours — a section of the same edit page (BUILD-SPEC-PR5 §1), its own
// AdminForm/action. 42 flat text fields rather than a repeatable field: a
// repeatable field means a second client component and a second validation
// style outside the pure `parseHoursInput`.
// ---------------------------------------------------------------------------

const DAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS_SLOTS_PER_DAY = 3;

export function hoursFields(): FieldDef[] {
  const fields: FieldDef[] = [];
  for (let day = 0; day <= 6; day++) {
    for (let slot = 0; slot < HOURS_SLOTS_PER_DAY; slot++) {
      const turno = slot + 1;
      fields.push(
        {
          type: 'text',
          name: `hours_${day}_${slot}_open`,
          label: `${DAY_LABELS_ES[day]} — turno ${turno}: apertura`,
          hint: turno === 1 ? 'Formato HH:MM. Dejá los dos campos vacíos si el negocio no abre ese día.' : 'HH:MM',
        },
        { type: 'text', name: `hours_${day}_${slot}_close`, label: `${DAY_LABELS_ES[day]} — turno ${turno}: cierre` },
      );
    }
  }
  return fields;
}

/** `DayHours[]` → the flat `hours_<day>_<slot>_open/close` keys `hoursFields()` expects. */
export function hoursDefaultValues(hours: DayHours[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const dh of hours) {
    dh.ranges.forEach((r, slot) => {
      if (slot >= HOURS_SLOTS_PER_DAY) return; // the UI offers 3 slots; a 4th has never been needed
      values[`hours_${dh.day}_${slot}_open`] = r.open;
      values[`hours_${dh.day}_${slot}_close`] = r.close;
    });
  }
  return values;
}

// ---------------------------------------------------------------------------
// verified / premiumUntil (BUILD-SPEC-PR5 §3) — admin only, its own form and
// its own query-module function, so the editor-facing update path is
// physically unable to set these.
// ---------------------------------------------------------------------------

/**
 * Two field lists, two forms (ROADMAP W2-2). `verified` is a human assertion,
 * `premiumUntil` is a sale — see the comment above `setListingVerified` in
 * `lib/db/listings-admin.ts` for why they no longer share a write path.
 */
export function verifiedFields(): FieldDef[] {
  return [
    {
      type: 'checkbox',
      name: 'verified',
      label: 'Verificado',
      hint: 'Marcá esto solo después de confirmar el negocio en persona o por teléfono. No se vende.',
    },
  ];
}

export function verifiedDefaultValues(verified: boolean): Record<string, unknown> {
  return { verified };
}

export function premiumFields(): FieldDef[] {
  return [
    {
      type: 'text',
      name: 'premiumUntil',
      label: 'Premium hasta',
      hint:
        'Formato AAAA-MM-DD. Vacío = no premium. Podés poner una fecha pasada para cortar el premium ya mismo.',
    },
  ];
}

export function premiumDefaultValues(premiumUntil: number | null): Record<string, unknown> {
  return { premiumUntil: premiumUntil !== null ? formatPremiumUntilDate(premiumUntil) : '' };
}
