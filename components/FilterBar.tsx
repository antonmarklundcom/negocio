'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Category, City } from '@/lib/types';
import { ChevronDown } from './icons';

/**
 * Compact, URL-driven filter row (§6.2). Not a big coloured block — styled as
 * the reference's white pill controls. Every change updates the query string so
 * the view stays shareable and indexable.
 */
export function FilterBar({
  categories,
  cities,
  zonas,
  showRubro = true,
  showZona = true,
}: {
  categories: Category[];
  cities: City[];
  zonas: string[];
  showRubro?: boolean;
  showZona?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const abierto = params.get('abierto') === '1';

  const pill =
    'flex items-center gap-1.5 rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px] font-semibold text-ink cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showRubro && (
        <label className={`relative ${pill}`}>
          <select
            aria-label="Filtrar por rubro"
            value={params.get('rubro') ?? ''}
            onChange={(e) => setParam('rubro', e.target.value || null)}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="">Rubro: todos</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.labelPlural}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2 text-ink3" />
        </label>
      )}

      {showZona && (
        <label className={`relative ${pill}`}>
          <select
            aria-label="Filtrar por zona o ciudad"
            value={params.get('zona') ?? params.get('ciudad') ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(params.toString());
              next.delete('zona');
              next.delete('ciudad');
              next.delete('page');
              if (v.startsWith('z:')) next.set('zona', v.slice(2));
              else if (v.startsWith('c:')) next.set('ciudad', v.slice(2));
              router.push(`${pathname}?${next.toString()}`, { scroll: false });
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="">Zona: todas</option>
            <optgroup label="Ciudades">
              {cities.map((c) => (
                <option key={c.slug} value={`c:${c.slug}`}>
                  {c.label}
                </option>
              ))}
            </optgroup>
            {zonas.length > 0 && (
              <optgroup label="Barrios">
                {zonas.map((z) => (
                  <option key={z} value={`z:${z}`}>
                    {z}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2 text-ink3" />
        </label>
      )}

      <button
        type="button"
        onClick={() => setParam('abierto', abierto ? null : '1')}
        className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
          abierto ? 'border-terragold bg-terra2 text-terra' : 'border-line bg-paper text-ink2'
        }`}
      >
        {abierto && <span className="h-2 w-2 rounded-full bg-terragold" />}
        Abierto ahora
      </button>

      <div className="flex-1" />

      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-ink2">
        <span className="hidden sm:inline">Ordenar:</span>
        <span className="relative flex items-center">
          <select
            aria-label="Ordenar resultados"
            value={params.get('sort') ?? 'relevancia'}
            onChange={(e) => setParam('sort', e.target.value === 'relevancia' ? null : e.target.value)}
            className="cursor-pointer appearance-none bg-transparent pr-5 font-semibold text-ink outline-none"
          >
            <option value="relevancia">Relevancia</option>
            <option value="destacados">Destacados</option>
            <option value="nombre">Nombre</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-0 text-ink3" />
        </span>
      </label>
    </div>
  );
}
