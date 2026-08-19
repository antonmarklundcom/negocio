import { describe, expect, it } from 'vitest';
import {
  formatPremiumUntilDate,
  parseCategoryInput,
  parseCityInput,
  parseHoursInput,
  parseListingVerifiedInput,
  parsePremiumUntilInput,
  parseListingInput,
  parseListParams,
  parseLoginInput,
  parsePasswordChangeInput,
  parsePremiumUntilDate,
  parseUserInput,
} from '@/lib/admin/validation';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

const CATEGORIES = ['restaurantes', 'tiendas'];
const CITIES = ['asuncion', 'luque'];
const ICONS = ['utensils', 'bag'];

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

describe('parseListingInput', () => {
  const base = {
    name: 'Parrilla Don José',
    slug: 'parrilla-don-jose',
    categoria: 'restaurantes',
    ciudad: 'asuncion',
  };

  it('accepts a minimal valid create form', () => {
    const result = parseListingInput(form(base), 'create', CATEGORIES, CITIES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('Parrilla Don José');
    expect(result.data.slug).toBe('parrilla-don-jose');
    expect(result.data.lat).toBeNull();
    expect(result.data.lng).toBeNull();
  });

  it('omits slug entirely on update', () => {
    const { slug: _slug, ...rest } = base;
    const result = parseListingInput(form(rest), 'update', CATEGORIES, CITIES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('slug' in result.data).toBe(false);
  });

  it.each(['UPPER-CASE', 'has spaces', '-leading-hyphen', 'trailing-hyphen-', 'x'.repeat(192)])(
    'rejects an invalid slug: %s',
    (slug) => {
      const result = parseListingInput(form({ ...base, slug }), 'create', CATEGORIES, CITIES);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors['slug']).toBeTruthy();
    },
  );

  it('fails an unselected categoria/ciudad rather than defaulting to one', () => {
    const result = parseListingInput(form({ ...base, categoria: '', ciudad: '' }), 'create', CATEGORIES, CITIES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['categoria']).toBeTruthy();
    expect(result.errors['ciudad']).toBeTruthy();
  });

  it('rejects a categoria/ciudad that is not in the database-backed option list', () => {
    const result = parseListingInput(
      form({ ...base, categoria: 'no-existe', ciudad: 'no-existe' }),
      'create',
      CATEGORIES,
      CITIES,
    );
    expect(result.ok).toBe(false);
  });

  describe('coordinates', () => {
    it('accepts an empty pair', () => {
      const result = parseListingInput(form(base), 'create', CATEGORIES, CITIES);
      expect(result.ok && result.data.lat).toBeNull();
    });

    it('accepts a comma decimal separator', () => {
      const result = parseListingInput(form({ ...base, lat: '-25,29', lng: '-57,33' }), 'create', CATEGORIES, CITIES);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.lat).toBeCloseTo(-25.29);
      expect(result.data.lng).toBeCloseTo(-57.33);
    });

    it('rejects an out-of-range value', () => {
      const result = parseListingInput(form({ ...base, lat: '95', lng: '10' }), 'create', CATEGORIES, CITIES);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors['lat']).toBeTruthy();
    });

    it('rejects lat without lng and vice versa', () => {
      const onlyLat = parseListingInput(form({ ...base, lat: '-25.29' }), 'create', CATEGORIES, CITIES);
      expect(onlyLat.ok).toBe(false);
      if (!onlyLat.ok) expect(onlyLat.errors['lng']).toBeTruthy();

      const onlyLng = parseListingInput(form({ ...base, lng: '-57.33' }), 'create', CATEGORIES, CITIES);
      expect(onlyLng.ok).toBe(false);
      if (!onlyLng.ok) expect(onlyLng.errors['lat']).toBeTruthy();
    });
  });

  describe('optional email', () => {
    it('is ok when empty', () => {
      const result = parseListingInput(form(base), 'create', CATEGORIES, CITIES);
      expect(result.ok && result.data.email).toBeNull();
    });

    it('rejects a malformed value', () => {
      const result = parseListingInput(form({ ...base, email: 'not-an-email' }), 'create', CATEGORIES, CITIES);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors['email']).toBeTruthy();
    });
  });

  describe('block fields', () => {
    it('parses especialidades, productos and servicios', () => {
      const result = parseListingInput(
        form({
          ...base,
          especialidades: 'Empanadas\nMilanesas',
          productos: 'Remera | Gs. 80.000\nGorra',
          servicios: 'Delivery | Hasta las 23:00\nRetiro en local',
        }),
        'create',
        CATEGORIES,
        CITIES,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.especialidades).toEqual(['Empanadas', 'Milanesas']);
      expect(result.data.productos).toEqual([
        { title: 'Remera', price: 'Gs. 80.000' },
        { title: 'Gorra' },
      ]);
      expect(result.data.servicios).toEqual([
        { title: 'Delivery', desc: 'Hasta las 23:00' },
        { title: 'Retiro en local' },
      ]);
    });

    it('an empty textarea parses to null, not an empty list', () => {
      const result = parseListingInput(form(base), 'create', CATEGORIES, CITIES);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.especialidades).toBeNull();
      expect(result.data.productos).toBeNull();
      expect(result.data.servicios).toBeNull();
    });

    it('destacadoItem stays null unless a title is given', () => {
      const withoutTitle = parseListingInput(
        form({ ...base, destacadoPrice: 'Gs. 50.000' }),
        'create',
        CATEGORIES,
        CITIES,
      );
      expect(withoutTitle.ok).toBe(false);
      if (!withoutTitle.ok) expect(withoutTitle.errors['destacadoTitle']).toBeTruthy();

      const withTitle = parseListingInput(
        form({ ...base, destacadoTitle: 'Menú del día', destacadoPrice: 'Gs. 50.000' }),
        'create',
        CATEGORIES,
        CITIES,
      );
      expect(withTitle.ok).toBe(true);
      if (!withTitle.ok) return;
      expect(withTitle.data.destacadoItem).toEqual({ title: 'Menú del día', price: 'Gs. 50.000' });
    });
  });
});

describe('parseCategoryInput', () => {
  const base = { slug: 'mascotas', label: 'Mascotas', labelPlural: 'Tiendas de mascotas', icon: 'bag', blockKind: 'shop', sortOrder: '3' };

  it('accepts a complete create form', () => {
    const result = parseCategoryInput(form(base), 'create', ICONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ ...base, sortOrder: 3 });
  });

  it('rejects an icon not in the resolvable set', () => {
    const result = parseCategoryInput(form({ ...base, icon: 'not-a-real-icon' }), 'create', ICONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['icon']).toBeTruthy();
  });

  it('fails an unselected blockKind rather than defaulting to one', () => {
    const result = parseCategoryInput(form({ ...base, blockKind: '' }), 'create', ICONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['blockKind']).toBeTruthy();
  });

  it('omits slug on update', () => {
    const { slug: _slug, ...rest } = base;
    const result = parseCategoryInput(form(rest), 'update', ICONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('slug' in result.data).toBe(false);
  });
});

describe('parseCityInput', () => {
  const base = { slug: 'aregua', label: 'Areguá', sortOrder: '9' };

  it('accepts a complete create form', () => {
    const result = parseCityInput(form(base), 'create');
    expect(result.ok).toBe(true);
  });

  it('accepts a coordinate pair and rejects a lone one', () => {
    const paired = parseCityInput(form({ ...base, lat: '-25.3', lng: '-57.6' }), 'create');
    expect(paired.ok).toBe(true);

    const lone = parseCityInput(form({ ...base, lat: '-25.3' }), 'create');
    expect(lone.ok).toBe(false);
  });
});

describe('parseHoursInput', () => {
  function hoursForm(entries: Record<string, string>): FormData {
    return form(entries);
  }

  it('both blank means the slot does not exist — an empty form is valid and empty', () => {
    const result = parseHoursInput(hoursForm({}));
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('accepts a normal day', () => {
    const result = parseHoursInput(hoursForm({ hours_3_0_open: '08:00', hours_3_0_close: '17:00' }));
    expect(result).toEqual({ ok: true, data: [{ day: 3, ranges: [{ open: '08:00', close: '17:00' }] }] });
  });

  it('accepts a split day (the siesta gap) with two slots, sorted by opening time', () => {
    const result = parseHoursInput(
      hoursForm({
        hours_3_1_open: '15:00',
        hours_3_1_close: '19:00',
        hours_3_0_open: '08:00',
        hours_3_0_close: '12:00',
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: [
        {
          day: 3,
          ranges: [
            { open: '08:00', close: '12:00' },
            { open: '15:00', close: '19:00' },
          ],
        },
      ],
    });
  });

  it('accepts a midnight crosser (close <= open) without swapping it', () => {
    const result = parseHoursInput(hoursForm({ hours_5_0_open: '22:00', hours_5_0_close: '02:00' }));
    expect(result).toEqual({ ok: true, data: [{ day: 5, ranges: [{ open: '22:00', close: '02:00' }] }] });
  });

  it('accepts a 00:00 close as midnight, not "closes before it opens"', () => {
    const result = parseHoursInput(hoursForm({ hours_5_0_open: '18:00', hours_5_0_close: '00:00' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]!.ranges[0]).toEqual({ open: '18:00', close: '00:00' });
  });

  it('one blank and the other filled is a field error on the blank one', () => {
    const result = parseHoursInput(hoursForm({ hours_1_0_open: '08:00' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['hours_1_0_close']).toBeTruthy();
    expect(result.errors['hours_1_0_open']).toBeFalsy();
  });

  it('rejects a malformed time, naming the day', () => {
    const result = parseHoursInput(hoursForm({ hours_2_0_open: '25:00', hours_2_0_close: '18:00' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['hours_2_0_open']).toContain('Martes');
  });

  it('open === close is rejected — zero-length and indistinguishable from 24h', () => {
    const result = parseHoursInput(hoursForm({ hours_1_0_open: '09:00', hours_1_0_close: '09:00' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['hours_1_0_close']).toBeTruthy();
  });

  it('two slots starting at the same minute on the same day is an error on the second', () => {
    const result = parseHoursInput(
      hoursForm({
        hours_1_0_open: '08:00',
        hours_1_0_close: '12:00',
        hours_1_1_open: '08:00',
        hours_1_1_close: '20:00',
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['hours_1_1_open']).toBeTruthy();
  });

  it('overlapping ranges on the same day are rejected', () => {
    const result = parseHoursInput(
      hoursForm({
        hours_1_0_open: '08:00',
        hours_1_0_close: '14:00',
        hours_1_1_open: '12:00',
        hours_1_1_close: '18:00',
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.values(result.errors).some((m) => m.includes('superponen'))).toBe(true);
  });

  it('result is sorted by day', () => {
    const result = parseHoursInput(
      hoursForm({
        hours_5_0_open: '08:00',
        hours_5_0_close: '12:00',
        hours_1_0_open: '08:00',
        hours_1_0_close: '12:00',
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((d) => d.day)).toEqual([1, 5]);
  });
});

describe('premiumUntil', () => {
  it('parses YYYY-MM-DD to unix seconds at 23:59:59 America/Asuncion (UTC-3)', () => {
    const seconds = parsePremiumUntilDate('2026-08-31');
    expect(seconds).not.toBeNull();
    // 23:59:59 -03:00 on the 31st is 02:59:59 UTC on the 1st.
    expect(new Date(seconds! * 1000).toISOString()).toBe('2026-09-01T02:59:59.000Z');
  });

  it('round-trips back to the same date string without shifting a day', () => {
    for (const date of ['2026-01-01', '2026-08-31', '2026-12-31', '2027-02-28']) {
      const seconds = parsePremiumUntilDate(date);
      expect(seconds).not.toBeNull();
      expect(formatPremiumUntilDate(seconds!)).toBe(date);
    }
  });

  it('empty string is null', () => {
    expect(parsePremiumUntilDate('')).toBeNull();
  });

  it('rejects a malformed date', () => {
    for (const bad of ['not-a-date', '2026-13-01', '2026-02-30', '31-08-2026']) {
      expect(parsePremiumUntilDate(bad)).toBeNull();
    }
  });
});

describe('parseListingVerifiedInput (ROADMAP W2-2)', () => {
  it('an unchecked box parses to false', () => {
    expect(parseListingVerifiedInput(form({}))).toEqual({ ok: true, data: { verified: false } });
  });

  it('a checked box parses to true', () => {
    expect(parseListingVerifiedInput(form({ verified: 'on' }))).toEqual({
      ok: true,
      data: { verified: true },
    });
  });

  it('ignores premiumUntil entirely', () => {
    // The whole point of the split: this parser feeds a function that cannot
    // write `premiumUntil`, so a stray field must not travel with it.
    const result = parseListingVerifiedInput(form({ verified: 'on', premiumUntil: '2026-12-31' }));
    expect(result).toEqual({ ok: true, data: { verified: true } });
  });
});

describe('parsePremiumUntilInput (ROADMAP W2-2)', () => {
  it('an empty date parses to null', () => {
    expect(parsePremiumUntilInput(form({}))).toEqual({ ok: true, data: { premiumUntil: null } });
  });

  it('accepts a valid date', () => {
    const result = parsePremiumUntilInput(form({ premiumUntil: '2026-12-31' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.premiumUntil).not.toBeNull();
  });

  it('rejects a malformed date', () => {
    const result = parsePremiumUntilInput(form({ premiumUntil: 'not-a-date' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors['premiumUntil']).toBeTruthy();
  });

  it('ignores verified entirely', () => {
    // The bug the split removes: an unchecked checkbox submits NOTHING, so a
    // combined parser turned "saved the premium date" into "un-verified the
    // business" on any form that did not render the checkbox.
    const result = parsePremiumUntilInput(form({ premiumUntil: '2026-12-31' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data)).toEqual(['premiumUntil']);
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
