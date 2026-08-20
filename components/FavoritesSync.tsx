'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import { useRouter } from '@/lib/i18n/link';
import {
  decodeFavorites,
  encodeFavorites,
  FAVORITES_EVENT,
  FAVORITES_KEY,
  parseFavorites,
  sameList,
} from '@/lib/favorites';

/**
 * Puts the saved list into the URL so a **server component** can render it
 * (ROADMAP W3-2).
 *
 * This exists because of a rule, not a preference: listing data on this site is
 * server-rendered, always — "never client-side `useEffect` fetching for
 * listings" (README → Rendering). Favorites live in `localStorage`, which the
 * server cannot see, so something has to carry them across. Writing them into
 * `?ids=` and re-rendering is the cheapest bridge that keeps the rule: the
 * cards, their JSON-LD and their prices all still come from the repo, and this
 * component never fetches a listing.
 *
 * It replaces rather than pushes, so the back button leaves `/favoritos`
 * instead of walking backwards through every save.
 *
 * `useRouter` is the locale-aware one (ROADMAP W3-3): the plain one would push
 * the Spanish `/favoritos` from `/en/favoritos`, dropping an English visitor
 * into Spanish the moment their list synced.
 */
export function FavoritesSync({ shown }: { shown: string[] }) {
  const t = useTranslations('favorites');
  const router = useRouter();
  const [empty, setEmpty] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => {
      let stored: string[] = [];
      try {
        stored = parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
      } catch {
        stored = [];
      }
      setEmpty(stored.length === 0);
      // Compare against what the server was actually given, so a visitor who
      // shared or bookmarked a `?ids=` URL is not immediately redirected to
      // their own list — only a real divergence from this browser's storage
      // triggers a navigation, and only once.
      const current = decodeFavorites(new URLSearchParams(window.location.search).get('ids') ?? undefined);
      if (sameList(stored, current)) return;
      const qs = stored.length > 0 ? `?ids=${encodeFavorites(stored)}` : '';
      router.replace(`/favoritos${qs}`, { scroll: false });
    };
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [router]);

  // The server rendered nothing and storage says there is nothing to render:
  // only now is "no saved businesses" the truth rather than "not read yet".
  if (shown.length > 0 || empty !== true) return null;

  return (
    <div className="rounded-card border border-line bg-paper p-10 text-center">
      <p className="font-serif text-xl font-semibold">{t('emptyTitle')}</p>
      <p className="mt-2 text-sm text-ink2">
        {t('emptyHint')}
      </p>
    </div>
  );
}
