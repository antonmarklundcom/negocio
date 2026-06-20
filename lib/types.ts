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
  sort?: 'relevancia' | 'destacados' | 'nombre';
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
