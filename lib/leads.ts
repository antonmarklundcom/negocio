import { z } from 'zod';
import { insertLead, updateLeadDelivery, type NewLead } from './db/leads';

/**
 * Single lead orchestrator (§7). Every contact path on the site converges here:
 * listing message, listing WhatsApp tracking, /sumar-negocio, /contacto.
 *
 * Design rules:
 *  - zod-validated discriminated union on `source`.
 *  - flat snake_case payload sent to each sink.
 *  - the lead is persisted to the `leads` table BEFORE the webhook fan-out, so
 *    it survives a dead webhook (a DB write failure is caught and logged, and
 *    NEVER fails the visitor's request — the lead still fans out to the sinks).
 *  - parallel fan-out (Promise.allSettled) with 3× exponential-backoff retries.
 *  - a DB write or webhook failure NEVER fails the user's request; if the lead
 *    was well-formed we return success. Until GHL/Sheets envs are set we log to
 *    the server console and still succeed (graceful degradation).
 */

export const leadSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('listing_message'),
    listingId: z.string().min(1),
    slug: z.string().min(1),
    message: z.string().min(1).max(2000),
    name: z.string().max(120).optional(),
    contact: z.string().max(160).optional(),
  }),
  z.object({
    source: z.literal('listing_whatsapp'),
    listingId: z.string().min(1),
    slug: z.string().min(1).optional(),
  }),
  z.object({
    source: z.literal('sumate'),
    businessName: z.string().min(1).max(160),
    category: z.string().min(1).max(80),
    city: z.string().min(1).max(80),
    contactName: z.string().min(1).max(120),
    phone: z.string().min(5).max(40),
  }),
  z.object({
    source: z.literal('contacto'),
    name: z.string().min(1).max(120),
    email: z.string().email().max(160),
    message: z.string().min(1).max(2000),
  }),
]);

export type Lead = z.infer<typeof leadSchema>;

const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const LEADS_WEBHOOK_TOKEN = process.env.LEADS_WEBHOOK_TOKEN || '';

/** Flatten any lead variant into a single snake_case record for the sinks. */
function toFlatPayload(lead: Lead): Record<string, string> {
  const base: Record<string, string> = {
    source: lead.source,
    received_at: new Date().toISOString(),
  };
  switch (lead.source) {
    case 'listing_message':
      return {
        ...base,
        listing_id: lead.listingId,
        listing_slug: lead.slug,
        message: lead.message,
        name: lead.name ?? '',
        contact: lead.contact ?? '',
      };
    case 'listing_whatsapp':
      return { ...base, listing_id: lead.listingId, listing_slug: lead.slug ?? '' };
    case 'sumate':
      return {
        ...base,
        business_name: lead.businessName,
        category: lead.category,
        city: lead.city,
        contact_name: lead.contactName,
        phone: lead.phone,
      };
    case 'contacto':
      return { ...base, name: lead.name, email: lead.email, message: lead.message };
  }
}

/** Map a validated lead into a `leads` row. Unset fields become NULL. */
function toLeadRow(lead: Lead): NewLead {
  const base: NewLead = { source: lead.source };
  switch (lead.source) {
    case 'listing_message':
      return {
        ...base,
        listingId: lead.listingId,
        listingSlug: lead.slug,
        message: lead.message,
        name: lead.name ?? null,
        contact: lead.contact ?? null,
      };
    case 'listing_whatsapp':
      return { ...base, listingId: lead.listingId, listingSlug: lead.slug ?? null };
    case 'sumate':
      return {
        ...base,
        businessName: lead.businessName,
        category: lead.category,
        city: lead.city,
        name: lead.contactName,
        phone: lead.phone,
      };
    case 'contacto':
      return { ...base, name: lead.name, email: lead.email, message: lead.message };
  }
}

/** Best-effort insert: logs and swallows any DB error, never throws to the caller. */
async function tryInsertLead(lead: Lead): Promise<number | undefined> {
  try {
    return await insertLead(toLeadRow(lead));
  } catch (err) {
    console.error('[leads] failed to persist lead to the database:', err);
    return undefined;
  }
}

/** Best-effort delivery update: logs and swallows any DB error. */
async function tryUpdateLeadDelivery(id: number, delivered: number, configured: number): Promise<void> {
  try {
    await updateLeadDelivery(id, delivered, configured);
  } catch (err) {
    console.error('[leads] failed to record delivery outcome for lead', id, err);
  }
}

async function postWithRetry(url: string, body: Record<string, string>, label: string): Promise<void> {
  const payload = LEADS_WEBHOOK_TOKEN ? { ...body, token: LEADS_WEBHOOK_TOKEN } : body;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 250); // 500ms, 1000ms
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
      lastErr = new Error(`${label} responded ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`${label} failed`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type LeadOutcome = { accepted: true; delivered: number; sinks: number };

/**
 * Accept and fan out a lead. Always resolves to `accepted: true` once the lead
 * is well-formed — sink failures are logged, never surfaced to the visitor.
 */
export async function handleLead(lead: Lead): Promise<LeadOutcome> {
  const payload = toFlatPayload(lead);

  // Persist first, so the lead survives a dead webhook. Never fails the request.
  const leadId = await tryInsertLead(lead);

  const sinks: { url: string; label: string }[] = [];
  if (GHL_WEBHOOK_URL) sinks.push({ url: GHL_WEBHOOK_URL, label: 'GoHighLevel' });
  if (SHEETS_WEBHOOK_URL) sinks.push({ url: SHEETS_WEBHOOK_URL, label: 'Google Sheets' });

  if (sinks.length === 0) {
    // No routing configured yet — degrade gracefully but never lose the lead.
    console.info('[leads] (no sinks configured) lead accepted:', payload);
    if (leadId !== undefined) await tryUpdateLeadDelivery(leadId, 0, 0);
    return { accepted: true, delivered: 0, sinks: 0 };
  }

  const results = await Promise.allSettled(
    sinks.map((s) => postWithRetry(s.url, payload, s.label)),
  );

  let delivered = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') delivered++;
    else console.error(`[leads] sink "${sinks[i]!.label}" failed after retries:`, r.reason);
  });

  if (leadId !== undefined) await tryUpdateLeadDelivery(leadId, delivered, sinks.length);

  return { accepted: true, delivered, sinks: sinks.length };
}
