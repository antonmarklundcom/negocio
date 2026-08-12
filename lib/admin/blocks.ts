/**
 * Pure parse/serialise for the JSON block fields (`especialidades`, `productos`,
 * `servicios`, `destacadoItem`). These columns are render-only — nothing
 * filters, sorts or joins on them — so they are edited as plain textareas, one
 * item per line, rather than a repeatable form field. See BUILD-SPEC-PR4 §1.4
 * for why: a repeatable field means a second client component and a second
 * validation style outside this pure module.
 *
 * No database, no session, no clock — the round-trip is unit-testable on its
 * own.
 */

export type LineError = { line: number; message: string };

/** `Empanadas\nMilanesas` → `['Empanadas', 'Milanesas']`. Blank lines dropped. */
export function parseLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Inverse of `parseLines`. */
export function serialiseLines(v: string[] | null): string {
  return v ? v.join('\n') : '';
}

/**
 * `Título | descripción` per line, up to `keys.length` columns. `|` beyond the
 * last key stays inside the final column, so a description containing a pipe
 * survives. A line whose first column is empty is a validation error naming
 * the 1-based line number — never silently dropped.
 */
export function parsePipedLines(
  raw: string,
  keys: readonly string[],
): { ok: true; rows: Record<string, string>[] } | { ok: false; error: LineError } {
  const rows: Record<string, string>[] = [];
  const lines = raw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const parts = line.split('|').map((p) => p.trim());
    const first = parts[0] ?? '';
    if (!first) {
      return { ok: false, error: { line: i + 1, message: `La línea ${i + 1} no tiene título.` } };
    }

    const row: Record<string, string> = {};
    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        // Last key absorbs everything past it, so a pipe inside the
        // description does not get truncated.
        row[key] = parts.slice(idx).join('|').trim();
      } else {
        row[key] = parts[idx] ?? '';
      }
    });
    rows.push(row);
  }

  return { ok: true, rows };
}

/** Inverse of `parsePipedLines`. Empty/absent values for non-first keys are omitted from the line. */
export function serialisePiped(rows: Record<string, string>[] | null, keys: readonly string[]): string {
  if (!rows) return '';
  return rows
    .map((row) =>
      keys
        .map((k) => row[k] ?? '')
        .join(' | ')
        // Trim trailing empty columns so "Título | |" doesn't round-trip ugly.
        .replace(/(\s*\|\s*)+$/, ''),
    )
    .join('\n');
}
