'use client';

import type { OpenState as OpenStateValue } from '@/lib/hours';
import type { DayHours } from '@/lib/types';
import { useLiveOpenState } from '@/lib/hours-client';
import { OpenNowPill, ClosedPill } from '@/components/Pills';

/**
 * Client wrapper around `OpenNowPill`/`ClosedPill` for the listing detail
 * page (ROADMAP F2). The page itself stays a server component — this is the
 * minimal client boundary needed so `useLiveOpenState` can recompute past
 * the page's hourly ISR staleness. `initial` is the server-computed value,
 * used for the first render so SSR markup matches.
 */
export function LiveOpenState({ hours, initial }: { hours: DayHours[] | undefined; initial: OpenStateValue }) {
  const open = useLiveOpenState(hours, initial);
  if ('unknown' in open) return null;
  if (open.open) return <OpenNowPill closesAt={open.closesAt} />;
  return <ClosedPill opensAt={open.opensAt} opensDay={open.opensDay} opensWhen={open.opensWhen} />;
}
