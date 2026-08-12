/**
 * Resolves a stored `url`/`cover_image` value to something an `<Image>` can
 * load. Pure, unit-tested — no `fetch`, no env read at call time beyond
 * `NEXT_PUBLIC_MEDIA_BASE_URL`.
 *
 * The column stores the OBJECT KEY (`listings/abc/def.webp`), never the full
 * URL — moving to a different CDN origin later is then a one-line env change,
 * not a hand-written UPDATE over every row (BUILD-SPEC-PR5 §2.3).
 *
 * Two escape hatches are load-bearing and must not be "simplified" away:
 *  - an absolute URL (`http(s)://…`) — legacy data, or a future external source
 *  - a root-relative path (`/seed/*.svg`) — the first-party seed placeholders,
 *    served from `public/`, which must keep rendering unchanged after this PR
 */
export function mediaUrl(stored: string): string {
  if (/^https?:\/\//.test(stored) || stored.startsWith('/')) return stored;
  return `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${stored}`;
}
