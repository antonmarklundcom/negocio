import type { FieldDef } from '@/components/admin/AdminForm';

export function cityFields(mode: 'create' | 'update'): FieldDef[] {
  const fields: FieldDef[] = [];

  if (mode === 'create') {
    fields.push({
      type: 'text',
      name: 'slug',
      label: 'URL (slug)',
      required: true,
      maxLength: 64,
      hint: 'Es la URL pública de la ciudad. No se puede cambiar después.',
    });
  }

  fields.push(
    { type: 'text', name: 'label', label: 'Etiqueta', required: true, maxLength: 120 },
    { type: 'number', name: 'sortOrder', label: 'Orden', required: true, min: 0, hint: 'La lista es curada, no alfabética.' },
    {
      type: 'text',
      name: 'lat',
      label: 'Latitud',
      hint: 'Centro de la ciudad. Se usa como referencia en el mapa para negocios sin coordenadas propias.',
    },
    { type: 'text', name: 'lng', label: 'Longitud', hint: 'Poné las dos coordenadas o ninguna.' },
  );

  return fields;
}
