/**
 * CSV serialisation (ROADMAP W2-5). Pure, so it is testable without a database
 * — the same rule the validation module follows.
 *
 * Two things this gets right that a `join(',')` does not:
 *
 *  1. **Quoting.** A lead message containing a comma, a quote or a newline is
 *     ordinary, not exotic. RFC 4180: wrap in quotes, double any inner quote.
 *  2. **Formula injection.** A field starting with `=`, `+`, `-` or `@` is
 *     executed as a formula when the file is opened in Excel or Sheets. These
 *     rows are written by members of the public, so that is a live attack path
 *     on whoever opens the export, not a hypothetical. Prefixing a single
 *     quote is the standard mitigation and is invisible in the cell.
 *
 * A UTF-8 BOM is prepended by `toCsv` because Excel on Windows otherwise reads
 * the file as Latin-1 and renders every "ó" and "í" as mojibake.
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_PREFIXES.some((p) => text.startsWith(p))) text = `'${text}`;

  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  // CRLF per RFC 4180, and a BOM so Excel does not mangle the accents.
  return `﻿${lines.join('\r\n')}\r\n`;
}
