'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Grid, Plus } from './icons';

const TABS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/rubros', label: 'Categorías', icon: Grid },
  { href: '/sumar-negocio', label: 'Sumate', icon: Plus },
] as const;

/** App-like mobile bottom tab bar (§6.8). Hidden at md+. Uses tokens only. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-content items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
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
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
