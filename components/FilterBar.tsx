'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/lib/i18n/link';
import { useCallback, useState } from 'react';
import type { Category, City } from '@/lib/types';
import { REVIEWS_ENABLED } from '@/lib/config';
import { roundCoord } from '@/lib/geo';
import { getPathname } from '@/lib/i18n/navigation';
import { useLocale } from 'next-intl';
import type { Locale } from '@/lib/i18n/routing';
import { ChevronDown, Pin, Search } from './icons';

/** Params the filter row owns; anything else in the URL is preserved untouched. */
const CARRIED = ['rubro', 'ciudad', 'zona', 'q', 'abierto', 'sort', 'lat', 'lng'] as const;

/**
 * Compact, URL-driven filter row (§6.2). Not a big coloured block — styled as
 * the reference's white pill controls. Every change updates the query string so
 * the view stays shareable and indexable.
 *
 * `useRouter`/`usePathname` come from the locale-aware navigation module
 * (ROADMAP W3-3): the plain ones would push `/buscar?...` from `/en/buscar`,
 * dropping an English visitor into Spanish the first time they touched a filter.
 * The `<form action>` needs the *prefixed* path, though — a browser GET submit
 * does not go through the router — so it is built with `getPathname`.
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
  const locale = useLocale() as Locale;
  // The real, locale-prefixed URL, because a plain GET submit bypasses the router.
  const formAction = getPathname({ href: pathname, locale });
  const [geo, setGeo] = useState<'idle' | 'locating' | 'denied'>('idle');

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
  const sort = params.get('sort') ?? 'relevancia';
  const nearby = sort === 'cerca' && !!params.get('lat') && !!params.get('lng');

  /**
   * "Cerca de mí" (ROADMAP W3-1). The browser prompt is the consent step, so
   * this is only ever wired to a button the visitor pressed — never to a mount
   * effect. Coordinates are rounded before they enter the URL (`roundCoord`),
   * because the query string is shareable and ends up in `document.referrer`.
   */
  const locate = useCallback(() => {
    if (nearby) {
      // Pressing it again turns the sort off, and takes the coordinates with it.
      const next = new URLSearchParams(params.toString());
      for (const k of ['sort', 'lat', 'lng', 'page']) next.delete(k);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo('denied');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.set('sort', 'cerca');
        next.set('lat', String(roundCoord(pos.coords.latitude)));
        next.set('lng', String(roundCoord(pos.coords.longitude)));
        next.delete('page');
        setGeo('idle');
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      },
      // A refusal is a legitimate answer, not an error to retry: say so once and
      // leave the results exactly as they were.
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [nearby, params, pathname, router]);

  const pill =
    'flex items-center gap-1.5 rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px] font-semibold text-ink cursor-pointer';

  return (
    <div className="space-y-3">
      {/*
        A real GET form, so searching works with JavaScript off and the result
        is a plain shareable URL (rule 9). The other active filters ride along
        as hidden fields — a GET submit replaces the whole query string, so
        anything not named here would be silently dropped on search.
      */}
      <form action={formAction} method="GET" className="flex items-center gap-2">
        {CARRIED.filter((k) => k !== 'q').map((k) => {
          const v = params.get(k);
          return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
        })}
        <label className="flex flex-1 items-center gap-2 rounded-[10px] border border-line bg-paper px-3 py-2">
          <Search size={16} className="shrink-0 text-ink3" />
          <input
            name="q"
            type="search"
            defaultValue={params.get('q') ?? ''}
            placeholder="Buscar por nombre, rubro o barrio…"
            aria-label="Buscar negocios"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
          />
        </label>
        <button
          type="submit"
          className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blued"
        >
          Buscar
        </button>
      </form>

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

        <button
          type="button"
          onClick={locate}
          aria-pressed={nearby}
          aria-live="polite"
          disabled={geo === 'locating'}
          className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
            nearby ? 'border-blue bg-bluebg text-blue' : 'border-line bg-paper text-ink2'
          }`}
        >
          <Pin size={13} />
          {geo === 'locating'
            ? 'Buscando tu ubicación…'
            : geo === 'denied'
              ? 'No pudimos ubicarte'
              : 'Cerca de mí'}
        </button>

        <div className="flex-1" />

        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-ink2">
          <span className="hidden sm:inline">Ordenar:</span>
          <span className="relative flex items-center">
            <select
              aria-label="Ordenar resultados"
              value={sort}
              onChange={(e) => setParam('sort', e.target.value === 'relevancia' ? null : e.target.value)}
              className="cursor-pointer appearance-none bg-transparent pr-5 font-semibold text-ink outline-none"
            >
              <option value="relevancia">Relevancia</option>
              <option value="destacados">Destacados</option>
              {/* Only offered while the ratings UI itself is on (§6.6). */}
              {REVIEWS_ENABLED && <option value="calificacion">Mejor calificados</option>}
              {/* Selectable only once "Cerca de mí" has supplied a position. */}
              {nearby && <option value="cerca">Cerca de mí</option>}
              <option value="nombre">Nombre</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-0 text-ink3" />
          </span>
        </label>
      </div>
    </div>
  );
}
