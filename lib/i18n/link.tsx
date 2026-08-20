'use client';

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware `Link`, `usePathname` and `useRouter` (ROADMAP W3-3).
 *
 * **Every internal link on the public site must come from here, not from
 * `next/link`.** A plain `<Link href="/precios">` rendered on `/en/buscar`
 * navigates to the *Spanish* `/precios`: the visitor falls out of English on
 * their first click and a crawler sees the English page linking into the
 * Spanish tree.
 *
 * WHY THIS FILE IS `'use client'`:
 * next-intl ships two builds of these helpers. The server one resolves the
 * locale from next-intl's *ambient request locale*, which in this app is not
 * reliable — `setRequestLocale` did not propagate to it under Next 16, and
 * `next/root-params`, the replacement next-intl now points at, needs the
 * `[locale]` segment to be a root param of **every** root layout, which it
 * cannot be while the staff panel lives outside the locale tree with a root
 * layout of its own. Measured before choosing this: with the server build,
 * `/en` rendered English text with Spanish, unprefixed hrefs.
 *
 * The client build reads the locale from `NextIntlClientProvider`, which
 * `(site)/[locale]/layout.tsx` gives an explicit locale taken from the URL
 * segment. That is a value that cannot be wrong.
 *
 * **This costs no extra client JavaScript.** `next/link` is itself a client
 * component, so every one of these links already crossed that boundary; the
 * only change is which module renders the `<a>`.
 *
 * The staff panel keeps `next/link`: it lives outside the `[locale]` segment
 * and has no locale to preserve.
 */
export const { Link, usePathname, useRouter } = createNavigation(routing);
