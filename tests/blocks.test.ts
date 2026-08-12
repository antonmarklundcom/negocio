import { describe, expect, it } from 'vitest';
import { parseLines, parsePipedLines, serialiseLines, serialisePiped } from '@/lib/admin/blocks';

describe('parseLines', () => {
  it('trims whitespace and drops blank lines', () => {
    expect(parseLines('  Empanadas  \n\nMilanesas\n   \nPizza')).toEqual(['Empanadas', 'Milanesas', 'Pizza']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseLines('')).toEqual([]);
  });
});

describe('parsePipedLines', () => {
  it('parses title|desc pairs, trimming each column', () => {
    const result = parsePipedLines(' Delivery  |  Hasta las 23:00 \nRetiro en local', ['title', 'desc']);
    expect(result).toEqual({
      ok: true,
      rows: [
        { title: 'Delivery', desc: 'Hasta las 23:00' },
        { title: 'Retiro en local', desc: '' },
      ],
    });
  });

  it('drops blank lines', () => {
    const result = parsePipedLines('Uno | dos\n\n   \nTres', ['title', 'desc']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
  });

  it('keeps a pipe inside the last column instead of truncating it', () => {
    const result = parsePipedLines('Combo | 2x1 | fin de semana', ['title', 'desc']);
    expect(result).toEqual({ ok: true, rows: [{ title: 'Combo', desc: '2x1|fin de semana' }] });
  });

  it('errors, naming the line number, when the first column is empty', () => {
    const result = parsePipedLines('Uno | dos\n| solo-desc\nTres | cuatro', ['title', 'desc']);
    expect(result).toEqual({ ok: false, error: { line: 2, message: 'La línea 2 no tiene título.' } });
  });
});

describe('round-trip', () => {
  it('serialiseLines then parseLines recovers the same list', () => {
    const items = ['Empanadas', 'Milanesas', 'Pizza'];
    expect(parseLines(serialiseLines(items))).toEqual(items);
  });

  it('null -> "" -> [] for parseLines (the caller maps [] back to null)', () => {
    expect(serialiseLines(null)).toBe('');
    expect(parseLines(serialiseLines(null))).toEqual([]);
  });

  it('serialisePiped then parsePipedLines recovers the same rows', () => {
    const rows = [
      { title: 'Delivery', desc: 'Hasta las 23:00' },
      { title: 'Retiro en local', desc: '' },
    ];
    const result = parsePipedLines(serialisePiped(rows, ['title', 'desc']), ['title', 'desc']);
    expect(result).toEqual({ ok: true, rows });
  });

  it('null -> "" -> [] for serialisePiped/parsePipedLines', () => {
    expect(serialisePiped(null, ['title', 'desc'])).toBe('');
    const result = parsePipedLines(serialisePiped(null, ['title', 'desc']), ['title', 'desc']);
    expect(result).toEqual({ ok: true, rows: [] });
  });
});
