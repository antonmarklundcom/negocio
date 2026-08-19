import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lib/leads.ts` persists every lead to the `leads` table BEFORE fanning out
 * to the webhook sinks (§ ROADMAP PR-2, Phase D item 1's prerequisite). These
 * tests mock `lib/db/leads` (so no MySQL connection is made) and assert:
 *  - the DB write happens before the webhook fan-out,
 *  - a DB write failure is caught and logged, never fails the visitor's request,
 *  - the request still succeeds with no sinks configured.
 */

vi.mock('server-only', () => ({}));

const insertLeadMock = vi.fn<(row: unknown) => Promise<number | undefined>>();
const updateLeadDeliveryMock = vi.fn<
  (id: number, delivered: number, configured: number) => Promise<void>
>();

vi.mock('../lib/db/leads', () => ({
  insertLead: insertLeadMock,
  updateLeadDelivery: updateLeadDeliveryMock,
}));

const ORIGINAL_ENV = { ...process.env };

async function importLeadsWithEnv(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import('../lib/leads');
}

describe('handleLead', () => {
  beforeEach(() => {
    insertLeadMock.mockReset();
    updateLeadDeliveryMock.mockReset();
    insertLeadMock.mockResolvedValue(1);
    updateLeadDeliveryMock.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('persists the lead and still accepts it when no sinks are configured', async () => {
    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: '',
      SHEETS_WEBHOOK_URL: '',
    });

    const outcome = await handleLead({
      source: 'contacto',
      name: 'Ana',
      email: 'ana@example.com',
      message: 'Hola, quiero info',
    });

    expect(outcome).toEqual({ accepted: true, delivered: 0, sinks: 0 });
    expect(insertLeadMock).toHaveBeenCalledTimes(1);
    expect(insertLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'contacto', name: 'Ana', email: 'ana@example.com' }),
    );
    expect(updateLeadDeliveryMock).toHaveBeenCalledWith(1, 0, 0);
  });

  it('does not fail the request when the database write throws', async () => {
    insertLeadMock.mockRejectedValue(new Error('connection refused'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: '',
      SHEETS_WEBHOOK_URL: '',
    });

    const outcome = await handleLead({
      source: 'listing_whatsapp',
      listingId: 'l1',
      slug: 'panaderia-central',
    });

    expect(outcome.accepted).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
    // Delivery is never recorded for a lead that failed to persist.
    expect(updateLeadDeliveryMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('writes to the database before fanning out to the webhook sinks', async () => {
    const order: string[] = [];
    insertLeadMock.mockImplementation(async () => {
      order.push('db');
      return 42;
    });

    const fetchMock = vi.fn(async () => {
      order.push('webhook');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: 'https://example.com/ghl',
      SHEETS_WEBHOOK_URL: '',
    });

    const outcome = await handleLead({
      source: 'sumate',
      businessName: 'Panadería Central',
      category: 'restaurantes',
      city: 'asuncion',
      contactName: 'Ana',
      phone: '595981234567',
    });

    expect(order).toEqual(['db', 'webhook']);
    expect(outcome).toEqual({ accepted: true, delivered: 1, sinks: 1 });
    expect(updateLeadDeliveryMock).toHaveBeenCalledWith(42, 1, 1);
  });

  it('still delivers to configured sinks even when persistence is unavailable', async () => {
    insertLeadMock.mockResolvedValue(undefined); // e.g. DATABASE_URL unset

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: 'https://example.com/ghl',
      SHEETS_WEBHOOK_URL: 'https://example.com/sheets',
    });

    const outcome = await handleLead({
      source: 'listing_message',
      listingId: 'l1',
      slug: 'panaderia-central',
      message: 'Consulta',
    });

    expect(outcome).toEqual({ accepted: true, delivered: 2, sinks: 2 });
    // No id came back from the DB, so there is nothing to update.
    expect(updateLeadDeliveryMock).not.toHaveBeenCalled();
  });
});

describe('listing_report (ROADMAP W1-1b)', () => {
  // The module is imported per-test elsewhere in this file so each case can set
  // its own env; the schema needs none of that.
  async function schema() {
    return (await import('../lib/leads')).leadSchema;
  }

  it('accepts a report with just a message', async () => {
    const leadSchema = await schema();
    const parsed = leadSchema.safeParse({
      source: 'listing_report',
      listingId: 'r1',
      slug: 'nande-cocina',
      message: 'El teléfono ya no existe.',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an optional contact', async () => {
    const leadSchema = await schema();
    const parsed = leadSchema.safeParse({
      source: 'listing_report',
      listingId: 'r1',
      slug: 'nande-cocina',
      message: 'Cerró en marzo.',
      contact: 'vecino@example.com',
    });
    expect(parsed.success && parsed.data.source === 'listing_report' && parsed.data.contact).toBe(
      'vecino@example.com',
    );
  });

  it('refuses a report with no listing and no message', async () => {
    const leadSchema = await schema();
    // Somebody telling us a phone number is wrong is doing us a favour, so the
    // contact is optional — but a report about nothing is not a report.
    expect(leadSchema.safeParse({ source: 'listing_report', listingId: 'r1', slug: 's' }).success).toBe(
      false,
    );
    expect(
      leadSchema.safeParse({ source: 'listing_report', slug: 's', message: 'algo' }).success,
    ).toBe(false);
    expect(
      leadSchema.safeParse({ source: 'listing_report', listingId: 'r1', slug: 's', message: '' }).success,
    ).toBe(false);
  });
});
