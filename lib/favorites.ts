/**
 * Favorites (ROADMAP W3-2 / D9) — saved businesses, in `localStorage`, with no
 * account and no database.
 *
 * Everything with a rule in it lives here and is pure, so it can be tested
 * without a browser: what a valid entry looks like, how many are kept, and how
 * the list is written into a URL. `components/FavoriteButton.tsx` is the only
 * thing that touches `window`.
 *
 * **Slugs, not ids.** A favorite has to survive being written into a URL and
 * read back by a server component, and the slug is the public identifier the
 * rest of the site already routes on. An internal row id in a shareable link
 * would leak the shape of the table for nothing.
 */

/** The `localStorage` key. Versioned, so a future shape change is a rename, not a migration. */
export const FAVORITES_KEY = 'negocio.favoritos.v1';

/** Fired on `window` after every write, so several buttons on one page stay in step. */
export const FAVORITES_EVENT = 'negocio:favoritos';

/**
 * Upper bound on saved businesses.
 *
 * Not a product limit — it is the page size the server can answer in one query
 * (`MAX_PAGE_SIZE`), and `/favoritos` renders the whole list at once. Saving
 * past the cap drops the oldest rather than refusing the new one: someone who
 * has saved sixty businesses is not trying to curate a list, and a save button
 * that silently stops working is worse than one that forgets.
 */
export const FAVORITES_LIMIT = 60;

/**
 * A slug we are willing to store. Deliberately strict: this value is read back
 * out of `localStorage` — which any script on the origin can write — and then
 * placed into a URL and a database query. The site's own slugs are
 * lowercase-hyphenated, so anything else is not ours.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG.test(value);
}

/**
 * Read a stored list back into slugs, most recently saved first.
 *
 * Never throws. Corrupt JSON, a non-array, or entries of the wrong shape all
 * degrade to "no favorites" or to the valid subset — a visitor whose storage
 * got mangled should lose a list, not a working page.
 */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of parsed) {
    if (!isValidSlug(entry) || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
    if (out.length >= FAVORITES_LIMIT) break;
  }
  return out;
}

export function serialiseFavorites(slugs: string[]): string {
  return JSON.stringify(slugs.slice(0, FAVORITES_LIMIT));
}

/** Add to the front (most recent first) or remove, capped. Returns a new array. */
export function toggleFavorite(current: string[], slug: string): string[] {
  if (!isValidSlug(slug)) return current;
  if (current.includes(slug)) return current.filter((s) => s !== slug);
  return [slug, ...current].slice(0, FAVORITES_LIMIT);
}

/**
 * The `?ids=` value `/favoritos` is rendered from.
 *
 * The list goes into the URL rather than being fetched from the client because
 * listing data on this site is server-rendered, always (README → Rendering:
 * never client-side `useEffect` fetching for listings). Putting the slugs in
 * the query string is what lets a server component do the reading, and it makes
 * a saved list shareable as a side effect — which is why `/favoritos` is
 * `noindex`: it is a personal URL, not a page for the index.
 */
export function encodeFavorites(slugs: string[]): string {
  return slugs.slice(0, FAVORITES_LIMIT).join(',');
}

export function decodeFavorites(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(',')) {
    const slug = part.trim();
    if (!isValidSlug(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= FAVORITES_LIMIT) break;
  }
  return out;
}

/** Whether the URL already shows exactly this list, in this order. */
export function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((slug, i) => slug === b[i]);
}
