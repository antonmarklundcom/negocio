import type { Listing } from './types';

/** A listing is premium while its paid window is still in the future (§5.2). */
export function isPremium(l: Listing): boolean {
  return !!l.premiumUntil && l.premiumUntil > Date.now() / 1000;
}
