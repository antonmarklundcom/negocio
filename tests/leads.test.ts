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

describe('handleLead — VenderCRM (ROADMAP F6)', () => {
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

  it('posts a sumate lead to VenderCRM with the API key header and a phone + stable idempotency_key', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: '',
      SHEETS_WEBHOOK_URL: '',
      VENDERCRM_URL: 'https://crm.example.com',
      VENDERCRM_API_KEY: 'secret-key',
    });

    const outcome = await handleLead({
      source: 'sumate',
      businessName: 'Panadería Central',
      category: 'restaurantes',
      city: 'asuncion',
      contactName: 'Ana',
      phone: '595981234567',
    });

    expect(outcome).toEqual({ accepted: true, delivered: 1, sinks: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://crm.example.com/api/v1/leads');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('secret-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.phone).toBe('595981234567');
    expect(typeof body.idempotency_key).toBe('string');
    expect((body.idempotency_key as string).length).toBeGreaterThanOrEqual(8);
  });

  it('does not attempt a VenderCRM POST for a contacto lead (no phone), and it does not count as a failed sink', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: '',
      SHEETS_WEBHOOK_URL: '',
      VENDERCRM_URL: 'https://crm.example.com',
      VENDERCRM_API_KEY: 'secret-key',
    });

    const outcome = await handleLead({
      source: 'contacto',
      name: 'Ana',
      email: 'ana@example.com',
      message: 'Hola, quiero info',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ accepted: true, delivered: 0, sinks: 0 });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('skipping VenderCRM for "contacto" lead: no phone field collected'),
    );

    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('produces the same idempotency_key for the same lead across two calls (retry-safe)', async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: '',
      SHEETS_WEBHOOK_URL: '',
      VENDERCRM_URL: 'https://crm.example.com',
      VENDERCRM_API_KEY: 'secret-key',
    });

    const lead = {
      source: 'sumate' as const,
      businessName: 'Panadería Central',
      category: 'restaurantes',
      city: 'asuncion',
      contactName: 'Ana',
      phone: '595981234567',
    };

    await handleLead(lead);
    await handleLead(lead);

    expect(bodies).toHaveLength(2);
    const key1 = (JSON.parse(bodies[0]!) as Record<string, unknown>).idempotency_key;
    const key2 = (JSON.parse(bodies[1]!) as Record<string, unknown>).idempotency_key;
    expect(key1).toBe(key2);
  });

  it('never attempts VenderCRM when VENDERCRM_URL/VENDERCRM_API_KEY are unset, and GHL/Sheets behavior is unchanged', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { handleLead } = await importLeadsWithEnv({
      GHL_WEBHOOK_URL: 'https://example.com/ghl',
      SHEETS_WEBHOOK_URL: '',
      VENDERCRM_URL: '',
      VENDERCRM_API_KEY: '',
    });

    const outcome = await handleLead({
      source: 'sumate',
      businessName: 'Panadería Central',
      category: 'restaurantes',
      city: 'asuncion',
      contactName: 'Ana',
      phone: '595981234567',
    });

    expect(outcome).toEqual({ accepted: true, delivered: 1, sinks: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/ghl', expect.anything());
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
