'use client';

import { useEffect, useState } from 'react';
import { computeOpenState, type OpenState } from './hours';
import type { DayHours } from './types';

/**
 * Keeps "Abierto ahora" live in the browser (ROADMAP F2).
 *
 * Both the home page and the detail page are ISR'd with `revalidate = 3600`
 * (W1-3), so the server-computed `initial` can be up to an hour stale by the
 * time a visitor's browser paints it — a listing that closed at 18:00 could
 * still say "Abierto ahora" at 18:45. `computeOpenState` is pure and safe to
 * call client-side (`Intl.DateTimeFormat`, no I/O), so this hook renders the
 * server value on first paint — required so SSR markup and the first client
 * render match exactly, or React throws a hydration mismatch — then
 * recomputes immediately in `useEffect` and every 60s after that.
 */
export function useLiveOpenState(hours: DayHours[] | undefined, initial: OpenState): OpenState {
  const [state, setState] = useState(initial);

  useEffect(() => {
    const recompute = () => setState(computeOpenState(hours));
    recompute();
    const id = setInterval(recompute, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  return state;
}
