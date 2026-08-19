import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/admin/csv';

/**
 * `lib/admin/csv.ts` is pure, so this needs no database — the same rule the
 * validation module follows.
 */
describe('csvCell', () => {
  it('passes ordinary text through untouched', () => {
    expect(csvCell('Panadería La Espiga')).toBe('Panadería La Espiga');
  });

  it('renders null and undefined as an empty field, not as the word', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes a field containing a comma', () => {
    expect(csvCell('Asunción, Paraguay')).toBe('"Asunción, Paraguay"');
  });

  it('quotes and doubles an inner quote', () => {
    expect(csvCell('dijo "excelente"')).toBe('"dijo ""excelente"""');
  });

  it('quotes a field containing a newline', () => {
    // A lead message with a line break is ordinary, not exotic.
    expect(csvCell('línea uno\nlínea dos')).toBe('"línea uno\nlínea dos"');
  });

  it('neutralises a formula so a spreadsheet cannot execute it', () => {
    // These rows are written by members of the public. A field starting with
    // = + - or @ runs as a formula in Excel and Sheets when the export is
    // opened, which makes this a live attack path on whoever opens the file.
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+34600000000')).toBe("'+34600000000");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
  });

  it('quotes AND neutralises a field that is both', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe('"\'=HYPERLINK(""http://x"",""click"")"');
  });

  it('serialises a Date as ISO 8601, not as a locale string', () => {
    expect(csvCell(new Date('2026-08-19T12:34:56.000Z'))).toBe('2026-08-19T12:34:56.000Z');
  });
});

describe('toCsv', () => {
  it('writes a BOM, CRLF line endings and a trailing newline', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]]);
    // The BOM is what stops Excel on Windows reading UTF-8 as Latin-1 and
    // turning every "ó" into mojibake.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿a,b\r\n1,2\r\n');
  });

  it('writes a header-only file when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('﻿a,b\r\n');
  });
});
