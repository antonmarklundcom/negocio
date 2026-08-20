/**
 * Which page numbers a pager should render (ROADMAP W3-1).
 *
 * Pure and separate from the component because it is the only part with a rule
 * in it. `/buscar` with no filters already spans enough pages that rendering
 * every number wraps the pager onto three lines on a phone, and it grows with
 * the directory: at a thousand listings the old pager was 84 links, all of them
 * crawled.
 *
 * The window always keeps the first page, the last page, and `radius` pages
 * either side of the current one, so the row's width is bounded no matter how
 * large the result set gets.
 */

/** `number` is a page link; `'gap'` is an elided run, rendered as an ellipsis. */
export type PageSlot = number | 'gap';

export function pageWindow(page: number, totalPages: number, radius = 1): PageSlot[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const wanted = new Set<number>([1, totalPages]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= totalPages) wanted.add(p);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const slots: PageSlot[] = [];
  let previous = 0;
  for (const p of pages) {
    // A gap of exactly one page is rendered as that page: "1 … 3 4 5" hides
    // nothing that "1 2 3 4 5" would not have shown, and costs a character more.
    if (previous && p - previous === 2) slots.push(previous + 1);
    else if (previous && p - previous > 2) slots.push('gap');
    slots.push(p);
    previous = p;
  }
  return slots;
}
