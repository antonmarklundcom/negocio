import type { FieldDef } from '@/components/admin/AdminForm';

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
