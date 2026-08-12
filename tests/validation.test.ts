import { describe, expect, it } from 'vitest';
import {
  parseListParams,
  parseLoginInput,
  parsePasswordChangeInput,
  parseUserInput,
} from '@/lib/admin/validation';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('parseUserInput', () => {
  it('accepts a complete create form and lowercases the email', () => {
    const result = parseUserInput(form({ name: 'Ana Ruiz', email: 'Ana@Negocio.com.py', role: 'editor' }), 'create');
    expect(result).toEqual({
      ok: true,
      data: { name: 'Ana Ruiz', email: 'ana@negocio.com.py', role: 'editor', status: 'active' },
    });
  });

  /**
   * The empty option is the only unselected state, and it FAILS. Nothing here
   * substitutes a default for a value a human has not chosen.
   */
  it('fails an unselected role rather than defaulting to one', () => {
    const result = parseUserInput(form({ name: 'Ana', email: 'ana@negocio.com.py', role: '' }), 'create');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['role']).toBeTruthy();
  });

  it('refuses the owner roles, which are reserved for the owner portal', () => {
    for (const role of ['owner_admin', 'owner_editor']) {
      const result = parseUserInput(form({ name: 'Ana', email: 'ana@negocio.com.py', role }), 'create');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors['role']).toBeTruthy();
    }
  });

  it('requires a status on update but never asks for one on create', () => {
    const created = parseUserInput(form({ name: 'Ana', email: 'ana@negocio.com.py', role: 'admin' }), 'create');
    expect(created.ok).toBe(true);

    const updated = parseUserInput(form({ name: 'Ana', email: 'ana@negocio.com.py', role: 'admin' }), 'update');
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.errors['status']).toBeTruthy();
  });

  it('reports every problem at once instead of one per submit', () => {
    const result = parseUserInput(form({ name: '', email: 'not-an-email', role: '' }), 'create');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['email', 'name', 'role']);
  });

  it('rejects values past the column length', () => {
    const result = parseUserInput(
      form({ name: 'x'.repeat(121), email: 'ana@negocio.com.py', role: 'editor' }),
      'create',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['name']).toBeTruthy();
  });

  it('trims whitespace-only input into the required-field error', () => {
    const result = parseUserInput(form({ name: '   ', email: 'ana@negocio.com.py', role: 'editor' }), 'create');
    expect(result.ok).toBe(false);
  });
});

describe('parseLoginInput', () => {
  it('accepts a filled form and normalises the email', () => {
    const result = parseLoginInput(form({ email: ' Ana@Negocio.com.py ', password: 'secreta-larga' }));
    expect(result).toEqual({ ok: true, data: { email: 'ana@negocio.com.py', password: 'secreta-larga' } });
  });

  /**
   * The login page has exactly ONE error message. Field-level errors here would
   * start to leak which half of the credential was recognised.
   */
  it('returns no field errors, ever', () => {
    for (const values of [{ email: '', password: 'x' }, { email: 'a@b.co', password: '' }]) {
      const result = parseLoginInput(form(values));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toEqual({});
    }
  });

  it('does not trim the password — a leading space is a character', () => {
    const result = parseLoginInput(form({ email: 'a@b.co', password: ' con espacio ' }));
    expect(result.ok && result.data.password).toBe(' con espacio ');
  });
});

describe('parsePasswordChangeInput', () => {
  const long = 'x'.repeat(MIN_PASSWORD_LENGTH);

  it('accepts a valid change', () => {
    const result = parsePasswordChangeInput(form({ current: 'vieja-larga', next: long, repeat: long }));
    expect(result).toEqual({ ok: true, data: { current: 'vieja-larga', next: long } });
  });

  it('rejects a short new password', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    const result = parsePasswordChangeInput(form({ current: 'vieja-larga', next: short, repeat: short }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['next']).toBeTruthy();
  });

  it('rejects a mismatched repeat', () => {
    const result = parsePasswordChangeInput(form({ current: 'vieja-larga', next: long, repeat: long + 'y' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['repeat']).toBeTruthy();
  });

  it('rejects reusing the current password', () => {
    const result = parsePasswordChangeInput(form({ current: long, next: long, repeat: long }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['next']).toBeTruthy();
  });

  it('requires the current password — a cookie is not proof of the password', () => {
    const result = parsePasswordChangeInput(form({ current: '', next: long, repeat: long }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['current']).toBeTruthy();
  });
});

describe('parseListParams', () => {
  it('defaults to page 1 with no search', () => {
    expect(parseListParams({})).toEqual({ q: '', page: 1 });
  });

  it('falls back to page 1 for junk, zero and negative pages', () => {
    for (const page of ['0', '-3', 'abc', '1.5', '']) {
      expect(parseListParams({ page }).page).toBe(1);
    }
  });

  it('takes the first value of a repeated parameter and caps the query length', () => {
    expect(parseListParams({ q: ['ana', 'otra'], page: ['2'] })).toEqual({ q: 'ana', page: 2 });
    expect(parseListParams({ q: 'x'.repeat(400) }).q.length).toBe(120);
  });
});
