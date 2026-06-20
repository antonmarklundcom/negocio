import type { ListingsProvider } from './types';
import type { DayHours, Listing } from '../types';
import { applyQuery, combosWithListings } from './query';
import { CATEGORIES } from '../categories';
import { CITIES } from '../cities';
import { initialOf } from '../format';

/**
 * JetEngine / WordPress REST provider (§5.3).
 *
 * Consumes the `negocios` custom post type from NEXT_PUBLIC_PANEL_URL. Auth is
 * a WordPress Application Password via Basic Auth, used SERVER-SIDE ONLY — creds
 * never reach the client. Every live failure degrades to the seed fallback
 * (handled in listings-repo), so a missing field or a down panel never breaks
 * the site.
 *
 * IMPORTANT: the meta field keys below are UNVERIFIED until checked against the
 * live JetEngine setup. Correct them in the single block marked
 * `=== JETENGINE FIELD MAP ===` once Diana configures the post type. A missing
 * field must map to `undefined`, never throw.
 */

const PANEL_URL = (process.env.NEXT_PUBLIC_PANEL_URL || '').replace(/\/$/, '');
const WP_APP_USER = process.env.WP_APP_USER || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';

/** Revalidate live data hourly (ISR). */
const REVALIDATE_SECONDS = 3600;

export function jetengineConfigured(): boolean {
  return !!(PANEL_URL && WP_APP_USER && WP_APP_PASSWORD);
}

function authHeader(): Record<string, string> {
  const token = Buffer.from(`${WP_APP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

// ---- Loose shapes for the WP REST payload (we only read what we map) --------
type WpTerm = { taxonomy?: string; slug?: string; name?: string };
type WpPost = {
  id: number;
  slug: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  meta?: Record<string, unknown>;
  acf?: Record<string, unknown>;
  _embedded?: { 'wp:term'?: WpTerm[][]; 'wp:featuredmedia'?: { source_url?: string }[] };
} & Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}
function stripHtml(v: unknown): string | undefined {
  const s = str(v);
  return s ? s.replace(/<[^>]+>/g, '').trim() : undefined;
}
function listOf(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter((x): x is string => !!x);
  const s = str(v);
  return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
}

function termFor(post: WpPost, taxonomy: string): WpTerm | undefined {
  const groups = post._embedded?.['wp:term'] ?? [];
  for (const group of groups) {
    const hit = group.find((t) => t.taxonomy === taxonomy);
    if (hit) return hit;
  }
  return undefined;
}

function mapPost(post: WpPost): Listing {
  const meta = { ...(post.meta ?? {}), ...(post.acf ?? {}) } as Record<string, unknown>;
  const name = stripHtml(post.title?.rendered) || post.slug;

  const categoriaTerm = termFor(post, 'categoria');
  const ciudadTerm = termFor(post, 'ciudad');
  const featured = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;

  // ============================ JETENGINE FIELD MAP ============================
  // TODO: verify every key on the right against the live JetEngine post type.
  // These are best-effort guesses; correct them here and nowhere else.
  const mapped: Listing = {
    id: String(post.id),
    slug: post.slug,
    name,
    categoria: categoriaTerm?.slug || 'profesionales', // TODO: verify taxonomy slug 'categoria'
    categoriaLabel: categoriaTerm?.name || 'Negocio',
    subtitle: str(meta['subtitulo']), // TODO: verify field key against live JetEngine
    description: stripHtml(post.content?.rendered) || stripHtml(post.excerpt?.rendered),
    ciudad: ciudadTerm?.slug || 'asuncion', // TODO: verify taxonomy slug 'ciudad'
    ciudadLabel: ciudadTerm?.name || 'Asunción',
    zona: str(meta['zona']), // TODO: verify field key against live JetEngine
    address: str(meta['direccion']), // TODO: verify field key against live JetEngine
    lat: num(meta['lat'] ?? meta['latitud']), // TODO: verify field key against live JetEngine
    lng: num(meta['lng'] ?? meta['longitud']), // TODO: verify field key against live JetEngine
    phone: str(meta['telefono']), // TODO: verify field key against live JetEngine
    whatsapp: str(meta['whatsapp']), // TODO: verify field key against live JetEngine
    email: str(meta['email']), // TODO: verify field key against live JetEngine
    website: str(meta['sitio_web']), // TODO: verify field key against live JetEngine
    instagram: str(meta['instagram']), // TODO: verify field key against live JetEngine
    logoInitial: initialOf(name),
    coverImage: featured || str(meta['cover']), // TODO: verify gallery/cover field keys
    gallery: listOf(meta['galeria']), // TODO: verify field key against live JetEngine
    hours: parseHours(meta['horarios']), // TODO: verify field key + shape against live JetEngine
    especialidades: listOf(meta['especialidades']), // TODO: verify field key
    verified: toBool(meta['verificado']), // TODO: verify field key against live JetEngine
    premiumUntil: num(meta['premium_until']), // TODO: verify field key (unix seconds)
  };
  // ========================== END JETENGINE FIELD MAP ==========================

  return mapped;
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'yes';
}

/**
 * Parse a horarios meta value into structured DayHours. The live shape is
 * unknown; we accept either an already-structured array or undefined. Anything
 * unrecognised maps to undefined so "Abierto ahora" simply does not render.
 */
function parseHours(v: unknown): DayHours[] | undefined {
  if (Array.isArray(v)) {
    const out: DayHours[] = [];
    for (const item of v) {
      if (item && typeof item === 'object' && 'day' in item && 'ranges' in item) {
        out.push(item as DayHours);
      }
    }
    return out.length ? out : undefined;
  }
  return undefined; // TODO: map JetEngine repeater shape once known
}

// ---- Fetch + cache the full set, then query in memory ----------------------
async function fetchAllPosts(): Promise<Listing[]> {
  const perPage = 100;
  const all: Listing[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${PANEL_URL}/wp-json/wp/v2/negocios?per_page=${perPage}&page=${page}&_embed=1`;
    const res = await fetch(url, {
      headers: authHeader(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      if (res.status === 400 && page > 1) break; // WP returns 400 past the last page
      throw new Error(`JetEngine REST ${res.status} on page ${page}`);
    }
    const batch = (await res.json()) as WpPost[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch.map(mapPost));
    if (batch.length < perPage) break;
  }
  return all;
}

export const jetengineProvider: ListingsProvider = {
  name: 'jetengine',

  async getListings(params) {
    return applyQuery(await fetchAllPosts(), params);
  },

  async getListingBySlug(slug) {
    const url = `${PANEL_URL}/wp-json/wp/v2/negocios?slug=${encodeURIComponent(slug)}&_embed=1`;
    const res = await fetch(url, { headers: authHeader(), next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(`JetEngine REST ${res.status} for slug ${slug}`);
    const batch = (await res.json()) as WpPost[];
    const post = Array.isArray(batch) ? batch[0] : undefined;
    return post ? mapPost(post) : null;
  },

  async getCategories() {
    const present = new Set((await fetchAllPosts()).map((l) => l.categoria));
    return CATEGORIES.filter((c) => present.has(c.slug));
  },

  async getCities() {
    const present = new Set((await fetchAllPosts()).map((l) => l.ciudad));
    return CITIES.filter((c) => present.has(c.slug));
  },

  async getCategoryCityCombosWithListings() {
    return combosWithListings(await fetchAllPosts());
  },
};
