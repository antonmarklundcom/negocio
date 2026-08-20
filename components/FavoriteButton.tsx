'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FAVORITES_EVENT,
  FAVORITES_KEY,
  parseFavorites,
  serialiseFavorites,
  toggleFavorite,
} from '@/lib/favorites';
import { Heart } from './icons';

/**
 * Save / unsave a business (ROADMAP W3-2 / D9). `localStorage`, no account, no
 * database, nothing sent anywhere.
 *
 * The only file in the app that touches `window.localStorage`; every rule about
 * what may be stored lives in `lib/favorites.ts`, which is pure and tested.
 */

/** Read the list, tolerating a browser that refuses storage entirely (Safari private mode). */
function read(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, serialiseFavorites(slugs));
  } catch {
    // Storage full or blocked. The heart still reflects this tab's state; it
    // just will not survive a reload. Losing a saved list is not worth an error
    // dialog on a directory page.
  }
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
}

export function FavoriteButton({
  slug,
  name,
  variant = 'icon',
  className = '',
}: {
  slug: string;
  name: string;
  /** `icon` is the small heart on a card; `full` is the labelled button on a detail page. */
  variant?: 'icon' | 'full';
  className?: string;
}) {
  /**
   * Starts `null`, not `false`.
   *
   * The server has no idea what this visitor saved, so the first client render
   * must match the server's output or React logs a hydration mismatch — and,
   * worse, a button that renders "not saved" and then flips would show the
   * wrong state for a frame on every saved business. `null` renders the neutral
   * outline and resolves after mount.
   */
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setSaved(read().includes(slug));
    sync();
    // Same page, other buttons (the card and the detail header) …
    window.addEventListener(FAVORITES_EVENT, sync);
    // … and other tabs, which get `storage` instead.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [slug]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // Cards wrap this in a link to the listing; saving is not navigating.
      e.preventDefault();
      e.stopPropagation();
      const next = toggleFavorite(read(), slug);
      setSaved(next.includes(slug));
      write(next);
    },
    [slug],
  );

  const on = saved === true;
  const label = on ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper/90 backdrop-blur transition-colors hover:border-terra ${
          on ? 'text-terra' : 'text-ink3'
        } ${className}`}
      >
        <Heart size={16} className={on ? 'fill-current' : undefined} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        on ? 'border-terra bg-terra2 text-terra' : 'border-line bg-paper text-ink2 hover:border-terra hover:text-terra'
      } ${className}`}
    >
      <Heart size={15} className={on ? 'fill-current' : undefined} />
      {on ? 'Guardado' : 'Guardar'}
    </button>
  );
}
