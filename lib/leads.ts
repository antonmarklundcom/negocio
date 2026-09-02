import { createHash } from 'node:crypto';
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
  /**
   * "Reportar información incorrecta" (ROADMAP W1-1b). Deliberately shaped
   * like `listing_message` and NOT like a support ticket: it goes through the
   * same orchestrator, lands in the same table, fans out to the same sinks and
   * appears on the same admin screen.
   *
   * `contact` is optional. Somebody telling us a phone number is wrong is
   * doing us a favour; demanding their email first is how the report does not
   * get sent.
   */
  z.object({
    source: z.literal('listing_report'),
    listingId: z.string().min(1),
    slug: z.string().min(1),
    message: z.string().min(1).max(2000),
    contact: z.string().max(160).optional(),
  }),
]);

export type Lead = z.infer<typeof leadSchema>;

const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const LEADS_WEBHOOK_TOKEN = process.env.LEADS_WEBHOOK_TOKEN || '';
const VENDERCRM_URL = process.env.VENDERCRM_URL || '';
const VENDERCRM_API_KEY = process.env.VENDERCRM_API_KEY || '';

/** Lead sources VenderCRM routing is scoped to (ROADMAP F6). */
type VenderCrmSource = 'sumate' | 'contacto' | 'listing_whatsapp';

function isVenderCrmSource(source: Lead['source']): source is VenderCrmSource {
  return source === 'sumate' || source === 'contacto' || source === 'listing_whatsapp';
}

/**
 * VenderCRM requires `phone` — it's the contact identity. Only `sumate`
 * collects one today; `contacto` and `listing_whatsapp` don't ask for
 * contact info at all. Never fabricate a value to satisfy the constraint
 * (same convention as `verified`/`rating` elsewhere in this codebase): an
 * honest absence beats a fake presence, so those two sources simply have no
 * usable phone and the VenderCRM POST is skipped for that lead.
 */
function vendercrmPhoneFor(lead: Lead): string | undefined {
  return lead.source === 'sumate' ? lead.phone : undefined;
}

type VenderCrmPayload = {
  phone: string;
  idempotency_key: string;
  name?: string;
  email?: string;
  message?: string;
  source?: string;
  fields?: Record<string, string>;
};

/**
 * Deterministic, stable idempotency key so `postWithRetry`'s 3 attempts (and
 * any upstream retry, e.g. a double form submit) land on the same VenderCRM
 * record instead of creating duplicate contacts. Hashes stable, identifying
 * lead fields plus an hour-coarse time bucket — matches the
 * `sha256(phone + "|" + YYYY-MM-DD-HH)` shape from the VenderCRM integration
 * guide, extended with a per-source discriminator so different lead sources
 * for the same phone/hour never collide.
 */
function vendercrmIdempotencyKey(lead: Lead, phone: string): string {
  const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const identity =
    lead.source === 'listing_whatsapp'
      ? `${lead.listingId}|${lead.slug ?? ''}`
      : lead.source === 'contacto'
        ? lead.email
        : phone;
  const hash = createHash('sha256').update(`${lead.source}|${identity}|${phone}|${hourBucket}`).digest('hex');
  return `${lead.source}-${hash.slice(0, 32)}`;
}

/** Build the VenderCRM-shaped payload for one of the three eligible sources. */
function toVenderCrmPayload(lead: Lead, phone: string): VenderCrmPayload {
  const payload: VenderCrmPayload = {
    phone,
    idempotency_key: vendercrmIdempotencyKey(lead, phone),
  };
  switch (lead.source) {
    case 'sumate':
      payload.name = lead.contactName;
      payload.message = `${lead.businessName} — ${lead.category}, ${lead.city}`;
      payload.fields = { business_name: lead.businessName, category: lead.category, city: lead.city };
      break;
    case 'contacto':
      payload.name = lead.name;
      // Omit rather than send "" — an empty string fails VenderCRM's email validation.
      if (lead.email) payload.email = lead.email;
      payload.message = lead.message;
      break;
    case 'listing_whatsapp':
      payload.fields = { listing_id: lead.listingId, listing_slug: lead.slug ?? '' };
      break;
  }
  return payload;
}

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
    case 'listing_report':
      return {
        ...base,
        listing_id: lead.listingId,
        listing_slug: lead.slug,
        message: lead.message,
        contact: lead.contact ?? '',
      };
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
    case 'listing_report':
      return {
        ...base,
        listingId: lead.listingId,
        listingSlug: lead.slug,
        message: lead.message,
        contact: lead.contact ?? null,
      };
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
        // Bound each webhook attempt so a hung sink can't stack up
        // requests across the 3 retries and other concurrent leads.
        signal: AbortSignal.timeout(10_000),
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

/** Outcome of attempting the VenderCRM sink for one lead. */
type VenderCrmResult = 'sent' | 'skipped-no-phone' | 'failed';

/**
 * VenderCRM POST with the same 3× exponential-backoff retry shape as
 * `postWithRetry`, kept separate because it needs an `X-Api-Key` header and
 * an idempotency-keyed body rather than GHL/Sheets' flat snake_case shape —
 * bending `postWithRetry` to carry both would make it harder to read for no
 * shared benefit. Never throws: skips (and logs) when there's no phone,
 * otherwise reports success/failure without surfacing anything to the caller.
 */
async function postToVenderCrm(lead: Lead): Promise<VenderCrmResult> {
  const phone = vendercrmPhoneFor(lead);
  if (!phone) {
    console.info(
      `[leads] skipping VenderCRM for "${lead.source}" lead: no phone field collected`,
    );
    return 'skipped-no-phone';
  }

  const payload = toVenderCrmPayload(lead, phone);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 250); // 500ms, 1000ms
    try {
      const res = await fetch(`${VENDERCRM_URL}/api/v1/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': VENDERCRM_API_KEY },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      // 201 created, 200 = idempotency replay — both are success.
      if (res.ok) return 'sent';
      lastErr = new Error(`VenderCRM responded ${res.status}: ${await res.text().catch(() => '')}`);
    } catch (err) {
      lastErr = err;
    }
  }
  console.error('[leads] VenderCRM sink failed after retries:', lastErr);
  return 'failed';
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

  // VenderCRM is only attempted for the three eligible sources, and only when
  // this particular lead actually has a phone to send — decided per-lead here
  // rather than as a static entry in `sinks`, so a source that can never carry
  // a phone (`contacto`, `listing_whatsapp`) doesn't drag down its own
  // delivered/sinks ratio with an attempt that could never succeed.
  const vendercrmEligible =
    Boolean(VENDERCRM_URL && VENDERCRM_API_KEY) &&
    isVenderCrmSource(lead.source) &&
    Boolean(vendercrmPhoneFor(lead));
  if (vendercrmEligible) sinks.push({ url: '', label: 'VenderCRM' });

  if (VENDERCRM_URL && VENDERCRM_API_KEY && isVenderCrmSource(lead.source) && !vendercrmEligible) {
    // Configured and an eligible source, but this particular lead has no
    // usable phone — log why, but never count it as an attempted sink.
    console.info(`[leads] skipping VenderCRM for "${lead.source}" lead: no phone field collected`);
  }

  if (sinks.length === 0) {
    // No routing configured yet (or this lead has nowhere eligible to go) —
    // degrade gracefully but never lose the lead.
    console.info('[leads] (no sinks configured) lead accepted:', payload);
    if (leadId !== undefined) await tryUpdateLeadDelivery(leadId, 0, 0);
    return { accepted: true, delivered: 0, sinks: 0 };
  }

  const results = await Promise.allSettled(
    sinks.map((s) =>
      s.label === 'VenderCRM'
        ? postToVenderCrm(lead).then((r) => {
            if (r === 'failed') throw new Error('VenderCRM sink failed');
          })
        : postWithRetry(s.url, payload, s.label),
    ),
  );

  let delivered = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') delivered++;
    else console.error(`[leads] sink "${sinks[i]!.label}" failed after retries:`, r.reason);
  });

  if (leadId !== undefined) await tryUpdateLeadDelivery(leadId, delivered, sinks.length);

  return { accepted: true, delivered, sinks: sinks.length };
}
