'use client';

import type { Lead } from './leads';

/** POST a lead via navigator.sendBeacon when possible, else fetch keepalive. */
export function trackLead(lead: Lead): void {
  try {
    const body = JSON.stringify(lead);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/v1/leads', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Tracking must never break the user's flow.
  }
}

/** POST a lead and await the result (for forms that show success/error). */
export async function submitLead(lead: Lead): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return !!json.ok;
  } catch {
    return false;
  }
}
