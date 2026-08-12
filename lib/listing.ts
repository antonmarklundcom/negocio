import type { Listing } from './types';

/** A listing is premium while its paid window is still in the future (§5.2). */
export function isPremium(l: Listing): boolean {
  return !!l.premiumUntil && l.premiumUntil > Date.now() / 1000;
}

/**
 * "Destacado en portada" (ROADMAP Phase D item 3): a home-page featured slot,
 * sold and tracked separately from Premium — Premium alone competes for the
 * home page's general "Negocios destacados" section, which shrinks as more
 * businesses go premium; a featured slot guarantees a spot regardless.
 */
export function isFeatured(l: Listing): boolean {
  return !!l.featuredUntil && l.featuredUntil > Date.now() / 1000;
}
