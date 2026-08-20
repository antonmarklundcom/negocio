import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Server-safe navigation helpers (ROADMAP W3-3).
 *
 * Only the functions that take the locale as an **explicit argument** live
 * here. `getPathname({ href, locale })` is what a plain `<form action>` or a
 * `redirect()` needs: a browser GET submit does not go through the router, so
 * it needs the real prefixed path.
 *
 * `Link`, `usePathname` and `useRouter` deliberately do NOT come from here —
 * see `./link.tsx` for why.
 */
export const { redirect, getPathname } = createNavigation(routing);
