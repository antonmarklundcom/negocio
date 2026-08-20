'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/link';
import { Home, Search, Grid, Plus } from './icons';

const TABS = [
  { href: '/', key: 'home', icon: Home },
  { href: '/buscar', key: 'search', icon: Search },
  { href: '/rubros', key: 'categories', icon: Grid },
  { href: '/sumar-negocio', key: 'add', icon: Plus },
] as const;

/**
 * App-like mobile bottom tab bar (§6.8). Hidden at md+. Uses tokens only.
 *
 * `usePathname` comes from the locale-aware navigation module: the plain one
 * returns `/en/buscar`, which matches none of these tabs, so on the English
 * site no tab would ever highlight.
 */
export function BottomNav() {
  const t = useTranslations('bottomNav');
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-content items-stretch justify-around">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  active ? 'text-blue' : 'text-ink3'
                }`}
              >
                <Icon size={20} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
