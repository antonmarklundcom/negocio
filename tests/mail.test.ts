import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { mailConfigured, staffRecipients } from '@/lib/mail';

/**
 * The env gate only. Actually sending is not unit-testable without an SMTP
 * server, and a test that asserted nodemailer was called would only be
 * asserting that nodemailer exists.
 */

const KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'MAIL_STAFF_TO'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function configure() {
  process.env.SMTP_HOST = 'smtp.hostinger.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'panel@negocio.com.py';
  process.env.SMTP_PASSWORD = 'secret';
  process.env.MAIL_FROM = 'panel@negocio.com.py';
}

describe('mailConfigured', () => {
  it('is false with nothing set — the app must boot without SMTP', () => {
    for (const key of KEYS) delete process.env[key];
    expect(mailConfigured()).toBe(false);
  });

  it('is false when any single variable is missing', () => {
    // A half-configured transport is the failure mode that looks configured
    // and then hangs on connect.
    for (const missing of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] as const) {
      configure();
      delete process.env[missing];
      expect(mailConfigured(), `missing ${missing}`).toBe(false);
    }
  });

  it('is true with all five set', () => {
    configure();
    expect(mailConfigured()).toBe(true);
  });
});

describe('staffRecipients', () => {
  it('splits a comma-separated list and trims it', () => {
    configure();
    process.env.MAIL_STAFF_TO = ' uno@x.py , dos@x.py ';
    expect(staffRecipients()).toEqual(['uno@x.py', 'dos@x.py']);
  });

  it('falls back to MAIL_FROM — a digest nobody reads beats one that goes nowhere', () => {
    configure();
    delete process.env.MAIL_STAFF_TO;
    expect(staffRecipients()).toEqual(['panel@negocio.com.py']);
  });

  it('is empty when nothing is set, so the route can refuse rather than send to nobody', () => {
    for (const key of KEYS) delete process.env[key];
    expect(staffRecipients()).toEqual([]);
  });
});
