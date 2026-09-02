/**
 * Core domain types for negocio.com.py.
 * These are the public contract every page, API route and provider speaks.
 * Keep them free of `any`.
 */

export type DayHours = {
  /** 0 = Sunday … 6 = Saturday (JS getDay convention). */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  ranges: { open: string; close: string }[]; // "HH:MM" 24h, America/Asuncion
};

export type Review = {
  author: string;
  rating: number; // 1..5
  text: string;
  /** Unix seconds. */
  date: number;
};

export type Listing = {
  id: string;
  slug: string;
  name: string;

  /**
   * Lifecycle (ROADMAP W2-1 / D2). Optional so the seed dataset — where every
   * listing is live by construction — does not have to repeat it 33 times;
   * absent means `published`.
   *
   * Both providers filter on it, so a component never has to. It is on the
   * public shape anyway so the two providers return the SAME object for the
   * same row, which is the entire promise of the seam in `lib/listings-repo.ts`.
   */
  status?: 'draft' | 'published' | 'archived';

  categoria: string; // taxonomy slug (rubro)
  categoriaLabel: string;
  subtitle?: string; // e.g. "Cocina paraguaya"
  description?: string;

  ciudad: string; // taxonomy slug
  ciudadLabel: string;
  zona?: string; // barrio (e.g. "Villa Morra")
  address?: string;
  lat?: number;
  lng?: number;

  phone?: string;
  whatsapp?: string; // E.164 digits for wa.me (no +, no spaces)
  email?: string;
  website?: string;
  instagram?: string;

  logoInitial: string; // derived from name when no logo
  coverImage?: string; // premium
  gallery?: string[]; // premium

  hours?: DayHours[]; // structured; drives "Abierto ahora"

  // category-specific premium "category block" — render only what exists:
  especialidades?: string[]; // chips (restaurante/cafe)
  destacadoItem?: { title: string; desc?: string; price?: string; image?: string }; // "Menú del día"
  productos?: { title: string; price?: string; image?: string }[]; // tienda
  servicios?: { title: string; desc?: string }[]; // servicio/taller

  // flags / monetization:
  verified: boolean; // drives "Verificado" chip
  premiumUntil?: number; // unix seconds; premium = premiumUntil > now
  featuredUntil?: number; // unix seconds; "destacado en portada" home-page slot, sold separately from premium
  updatedAt?: number; // unix seconds; sitemap lastModified (ROADMAP F5)

  // optional/honesty-gated stats (default hidden, see §6.6):
  rating?: number;
  reviewsCount?: number;
  reviews?: Review[];
  yearsActive?: number;
  avgResponseMins?: number;
};

export type Category = {
  slug: string;
  label: string;
  /** Plural display used on landing pages, e.g. "Restaurantes y cafés". */
  labelPlural: string;
  /** Lucide-style icon key resolved by components/icons. */
  icon: string;
  /** Which CategoryBlock variant a premium profile renders. */
  blockKind: 'food' | 'shop' | 'service' | 'default';
};

export type City = {
  slug: string;
  label: string;
};

export type ListingQuery = {
  categoria?: string;
  ciudad?: string;
  zona?: string;
  q?: string;
  abierto?: boolean;
  /** Only listings with an active "destacado en portada" slot (ROADMAP Phase D item 3). */
  destacado?: boolean;
  sort?: 'relevancia' | 'destacados' | 'nombre' | 'calificacion' | 'cerca';
  /**
   * The visitor's own position, for `sort: 'cerca'` (ROADMAP W3-1). Rounded to
   * `COORD_PRECISION` before it ever reaches here. `sort: 'cerca'` with no
   * point falls back to `relevancia` rather than returning nothing.
   */
  near?: { lat: number; lng: number };
  /** Exclude one listing by id — "Negocios similares" must not list the page it is on. */
  excludeId?: string;
  /**
   * Restrict to an explicit set of slugs (ROADMAP W3-2). `/favoritos` renders
   * from this: the saved list arrives as slugs in the URL and is read by a
   * server component, so favorites never become client-side listing fetching.
   * An empty array means "no listings", never "no filter".
   */
  slugs?: string[];
  premiumFirst?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListingResult = {
  items: Listing[];
  total: number;
};

export type CategoryCityCombo = {
  categoria: string;
  ciudad: string;
  count: number;
};

/** A rubro × ciudad × zona (barrio) combination that has at least one listing — the SEO barrio pages (ROADMAP Phase D item 6). */
export type CategoryCityZonaCombo = {
  categoria: string;
  ciudad: string;
  zona: string;
  count: number;
};
