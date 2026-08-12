import { describe, expect, it } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import {
  buildListingOrderBy,
  buildListingWhere,
  isPremiumSql,
  openNowSql,
} from '../lib/db/listing-query';
import {
  escapeLike,
  likePattern,
  MAX_PAGE_SIZE,
  pagination,
  sortPlan,
  taxonomySlugsMatching,
} from '../lib/db/query-helpers';
import type { SQL } from 'drizzle-orm';

/** Serialise a builder's SQL without a connection, so CI needs no MySQL. */
const dialect = new MySqlDialect();
function render(fragment: SQL | undefined): { sql: string; params: unknown[] } {
  if (!fragment) return { sql: '', params: [] };
  const query = dialect.sqlToQuery(fragment);
  return { sql: query.sql, params: query.params };
}

describe('escapeLike', () => {
  it('neutralises the wildcards, so "100%" is not a match-everything query', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
    expect(escapeLike('café')).toBe('café');
  });

  it('wraps the escaped term in its own wildcards', () => {
    expect(likePattern('50%')).toBe('%50\\%%');
  });
});

describe('pagination', () => {
  it('defaults to page 1', () => {
    expect(pagination({})).toMatchObject({ page: 1, offset: 0 });
  });

  it('computes the offset from the page', () => {
    expect(pagination({ page: 3, pageSize: 12 })).toMatchObject({ page: 3, limit: 12, offset: 24 });
  });

  it('clamps a nonsense page instead of producing a negative offset', () => {
    expect(pagination({ page: 0 })).toMatchObject({ page: 1, offset: 0 });
    expect(pagination({ page: -5 })).toMatchObject({ page: 1, offset: 0 });
  });

  it('caps the page size, so a crafted URL cannot scan the table', () => {
    expect(pagination({ pageSize: 100000 }).limit).toBe(MAX_PAGE_SIZE);
    expect(pagination({ pageSize: 0 }).limit).toBe(1);
  });
});

describe('sortPlan', () => {
  it('relevancia: premium, then verified, then name', () => {
    expect(sortPlan({})).toEqual({ premiumFirst: true, verifiedFirst: true });
  });

  it('honours premiumFirst: false on relevancia', () => {
    expect(sortPlan({ premiumFirst: false })).toEqual({ premiumFirst: false, verifiedFirst: true });
  });

  it('destacados: premium then name, without the verified tiebreak', () => {
    expect(sortPlan({ sort: 'destacados' })).toEqual({ premiumFirst: true, verifiedFirst: false });
  });

  it('nombre: name only', () => {
    expect(sortPlan({ sort: 'nombre' })).toEqual({ premiumFirst: false, verifiedFirst: false });
  });
});

describe('taxonomySlugsMatching', () => {
  it('matches a category by its singular or plural label', () => {
    expect(taxonomySlugsMatching('restaurante').categorias).toContain('restaurantes');
    expect(taxonomySlugsMatching('cafés').categorias).toContain('restaurantes');
  });

  it('matches a city with the accent typed or omitted', () => {
    expect(taxonomySlugsMatching('Asunción').ciudades).toEqual(['asuncion']);
    expect(taxonomySlugsMatching('asuncion').ciudades).toEqual(['asuncion']);
  });

  it('returns nothing for an empty term rather than matching everything', () => {
    expect(taxonomySlugsMatching('   ')).toEqual({ categorias: [], ciudades: [] });
  });
});

describe('buildListingWhere', () => {
  const at = { day: 3, minutes: 690 }; // Wednesday 11:30

  it('is undefined when nothing is filtered, so the query has no WHERE', () => {
    expect(buildListingWhere({}, at)).toBeUndefined();
  });

  it('binds the filters as parameters, never as inlined strings', () => {
    const { sql, params } = render(buildListingWhere({ categoria: 'restaurantes', ciudad: 'asuncion' }, at));
    expect(sql).toContain('`categoria`');
    expect(sql).toContain('`ciudad`');
    expect(params).toEqual(['restaurantes', 'asuncion']);
  });

  it('compares zona case-insensitively', () => {
    const { sql, params } = render(buildListingWhere({ zona: '  Villa Morra ' }, at));
    expect(sql).toContain('lower(');
    expect(params).toEqual(['villa morra']);
  });

  it('searches the text columns with an escaped pattern and the matching taxonomy slugs', () => {
    const { params } = render(buildListingWhere({ q: 'asuncion' }, at));
    expect(params.filter((p) => p === '%asuncion%')).toHaveLength(4);
    expect(params).toContain('asuncion'); // the city slug, added as an OR
  });

  it('passes the Asunción day and minute into the open-now check, plus yesterday', () => {
    const { sql, params } = render(buildListingWhere({ abierto: true }, at));
    expect(sql).toContain('exists');
    expect(sql).toContain('`listing_hours`');
    expect(params).toContain(3); // today
    expect(params).toContain(2); // yesterday, for ranges that crossed midnight
    expect(params.filter((p) => p === 690).length).toBeGreaterThan(0);
  });

  it('never asks MySQL for the time', () => {
    const { sql } = render(buildListingWhere({ abierto: true }, at));
    expect(sql.toLowerCase()).not.toContain('now()');
    expect(sql.toLowerCase()).not.toContain('curdate');
    expect(sql.toLowerCase()).not.toContain('curtime');
  });

  it('ANDs the filters together', () => {
    const { sql } = render(buildListingWhere({ categoria: 'restaurantes', ciudad: 'asuncion', q: 'pizza' }, at));
    expect(sql).toContain(' and ');
  });
});

describe('openNowSql', () => {
  it('covers all three cases: today, today-past-midnight, and yesterday-still-open', () => {
    const { sql } = render(openNowSql({ day: 0, minutes: 30 }));
    // Three OR-ed range conditions, one per case.
    expect(sql.match(/`close_minute`/g)?.length).toBe(5);
    expect(sql).toContain(' or ');
  });

  it('wraps Sunday back to Saturday for the overnight case', () => {
    const { params } = render(openNowSql({ day: 0, minutes: 30 }));
    expect(params).toContain(6);
  });
});

describe('buildListingOrderBy', () => {
  const now = 1_800_000_000;

  it('relevancia orders premium, then verified, then name', () => {
    const rendered = buildListingOrderBy({}, now).map((f) => render(f).sql);
    expect(rendered).toHaveLength(3);
    expect(rendered[0]).toContain('premium_until');
    expect(rendered[0]).toContain('desc');
    expect(rendered[1]).toContain('`verified` desc');
    expect(rendered[2]).toContain('`name` asc');
  });

  it('nombre orders by name alone', () => {
    const rendered = buildListingOrderBy({ sort: 'nombre' }, now).map((f) => render(f).sql);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toContain('`name` asc');
  });

  it('destacados drops the verified tiebreak', () => {
    const rendered = buildListingOrderBy({ sort: 'destacados' }, now).map((f) => render(f).sql);
    expect(rendered).toHaveLength(2);
    expect(rendered.join(' ')).not.toContain('verified');
  });

  it('compares premium against the app clock, passed as a parameter', () => {
    const { params } = render(isPremiumSql(now));
    expect(params).toEqual([now]);
  });
});
