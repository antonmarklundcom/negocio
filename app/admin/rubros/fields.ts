import type { FieldDef } from '@/components/admin/AdminForm';
import { BLOCK_KINDS } from '@/lib/db/schema';
import { BLOCK_KIND_LABELS } from '@/lib/admin/labels';

export function categoryFields(mode: 'create' | 'update', iconOptions: { value: string; label: string }[]): FieldDef[] {
  const fields: FieldDef[] = [];

  if (mode === 'create') {
    fields.push({
      type: 'text',
      name: 'slug',
      label: 'URL (slug)',
      required: true,
      maxLength: 64,
      hint: 'Es la URL pública del rubro (/[categoria]). No se puede cambiar después.',
    });
  }

  fields.push(
    { type: 'text', name: 'label', label: 'Etiqueta', required: true, maxLength: 120 },
    {
      type: 'text',
      name: 'labelPlural',
      label: 'Etiqueta plural',
      required: true,
      maxLength: 120,
      hint: 'Se usa en las páginas de rubro. Ej. "Restaurantes y cafés"',
    },
    {
      type: 'select',
      name: 'icon',
      label: 'Ícono',
      required: true,
      placeholder: '— Elegí un ícono —',
      options: iconOptions,
    },
    {
      type: 'select',
      name: 'blockKind',
      label: 'Tipo de bloque',
      required: true,
      placeholder: '— Elegí un tipo —',
      options: BLOCK_KINDS.map((k) => ({ value: k, label: BLOCK_KIND_LABELS[k] })),
      hint: 'Elige qué bloque premium se muestra en la ficha (menú, productos, servicios).',
    },
    {
      type: 'number',
      name: 'sortOrder',
      label: 'Orden',
      required: true,
      min: 0,
      hint: 'La taxonomía es curada, no alfabética.',
    },
  );

  return fields;
}
