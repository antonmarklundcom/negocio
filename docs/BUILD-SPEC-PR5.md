# BUILD-SPEC — PR-5: the awkward fields

> Hours editor · gallery & photo upload · `premiumUntil` · `verified` ·
> staleness dashboard.
>
> **Depends on PR-4 being merged.** The hours editor and the gallery manager hang
> off `/admin/negocios/[id]`, which PR-4 creates. Do not start this before PR-4
> is on `main`.
>
> Read first: `docs/BUILD-SPEC-PR4.md`, `ROADMAP.md` → Phase B, `README.md` →
> Database ("Time is computed in the app, never by MySQL").

---

## Open questions — these need a human

1. **The object-storage account does not exist yet.** This spec commits to
   **Cloudflare R2** (reasoning in §2.1) but somebody has to create the bucket
   and the API token and put five values in the Hostinger env panel. The code
   must therefore ship **inert**: with `R2_*` unset, the gallery UI renders a
   "Falta configurar el almacenamiento de imágenes" notice instead of an upload
   button, and nothing else in the panel changes. Do not block the rest of the PR
   on it, and do not invent credentials to test against.
2. **What counts as "stale"?** §5 uses 180 days since `updatedAt`. That is a
   guess at the right number, not a derived one. It is one constant.

---

## What PR-5 does NOT need

**No migration — again.** `verified`, `premium_until`, `listing_hours` and
`listing_gallery` (with `url`, `position`, `alt`) all shipped in PR-1's
`drizzle/0000_*`. **Do not run `db:generate`.** If you conclude you need a
column, stop and put the question in the PR body; a merged PR that needs an
unapplied migration 500s in production the moment it deploys.

The one dependency this PR does add is `aws4fetch` (§2.2) — a **`dependencies`**
entry, not a dev one, because the app calls it at runtime.

---

## 1. Hours editor

### Why this is not a normal field

`listing_hours` is a **child table that is queried**, not rendered: `openNowSql()`
builds a `WHERE` clause over `open_minute`/`close_minute` for "Abierto ahora". A
wrong write here does not look wrong on the profile page — it silently drops the
business out of the `?abierto=1` results. Test the query, not just the form.

### Storage recap (already fixed in the schema, do not change)

- one row per **contiguous range**: `(listing_id, day, open_minute, close_minute)`
- `day`: 0 = Sunday … 6 = Saturday (JS `getDay`, matching `DayHours`)
- minutes from midnight, not strings — the open-now check is numeric SQL
- `close <= open` means **the range crosses midnight** (23:00 → 02:00). `"00:00"`
  as a close is midnight, i.e. `closeMinute = 0`, which is the common case for a
  bar and must not be rejected as "close before open".
- unique index on `(listing_id, day, open_minute)` — two ranges on one day may
  not start at the same minute.

`lib/db/open-now.ts` already exports `toMinutes('HH:MM')` and `toHHMM(n)`;
`lib/db/mappers.ts` already exports `rowsToDayHours` and `dayHoursToRows`.
**Reuse all four. Do not write a second time parser.**

### Form shape

A section on the listing edit page — not a separate route. Seven days × **up to
three ranges** each, as flat text inputs inside the existing `AdminForm`:

```
hours_<day>_<slot>_open   hours_<day>_<slot>_close    day 0..6, slot 0..2
```

42 fields of `type: 'text'`, `placeholder`/hint `HH:MM`. Three slots covers
"morning, afternoon, evening", which is the real Paraguayan pattern (the siesta
split); a fourth has never been needed. Group them under a day label with
`AdminForm`'s `children` slot if the layout needs it — **do not add a new
`FieldDef` variant and do not add a second client component.**

Text inputs, not `type: 'time'`: the native time picker's serialised value varies
by locale and an empty one submits `''`, which is indistinguishable from "closed"
only by accident. Parse it yourself, in the pure module.

### Validation — `parseHoursInput(fd): ParseResult<DayHours[]>` in `lib/admin/validation.ts`

- both blank → that slot does not exist (this is how a day is marked closed:
  every slot blank)
- **one blank and the other filled** → field error on the blank one:
  `Completá la hora de apertura y la de cierre.` Never infer the missing half.
- format `^([01]\d|2[0-3]):([0-5]\d)$` — anything else is a field error naming the
  day in Spanish (`Lunes`, `Martes`, …)
- `open === close` → error: `Un turno no puede abrir y cerrar a la misma hora.`
  (zero-length, and it would also be indistinguishable from 24h)
- **`close < open` is VALID** — it crosses midnight. Do not "fix" it by swapping.
- two slots on the same day with the same `open` → error on the second, because
  the unique index would otherwise 500 the save
- overlapping ranges on the same day (e.g. 08:00–14:00 and 12:00–18:00) → error:
  `Los turnos del <día> se superponen.` The DB permits it; the open-now query
  would then match the listing twice through a join.
- result is **sorted** by day, then `openMinute`, so the round-trip is stable

Pure: no clock, no DB. This is what makes every one of the above a unit test.

### Write path — `setListingHours(actor, listingId, hours: DayHours[], database?)`

In `lib/db/listings-admin.ts`, guard `['admin', 'editor']`, and in **one
transaction**:

1. read the existing rows (for the audit before-snapshot, as `DayHours[]` via
   `rowsToDayHours`)
2. `delete` every row for that `listing_id`
3. `insert` the new rows from `dayHoursToRows(listingId, hours)` — skip the
   insert entirely when the array is empty
4. `logActivity(tx, {entityType: 'listing_hours', entityId: listingId,
   action: 'update', before, after})`

Delete-then-insert, not a diff: the rows have no stable identity (the autoincrement
id is not meaningful), a diff would be more code and its bugs would be silent.
It is one small table per listing, inside a transaction, so there is no window
where the hours are empty as far as any reader is concerned.

### Keeping "Abierto ahora" honest — required tests

In `tests/open-now.test.ts` / `tests/listing-query.test.ts`, add cases that go
**through the same helpers the write path uses**:

- a normal day (08:00–17:00): open at 12:00, closed at 07:59 and 17:01
- a split day (08:00–12:00, 15:00–19:00): **closed at 13:00** — the siesta gap is
  the case a naive min/max implementation gets wrong
- a midnight crosser (22:00–02:00): open at 23:30 **and** at 01:00 (which is the
  *previous* day's row — `previousDay()` exists for this), closed at 03:00
- a 00:00 close (18:00–00:00): open at 23:59
- `dayHoursToRows(rowsToDayHours(rows)) === rows` for all of the above

---

## 2. Gallery & photo upload

### 2.1 Where the files go — decided

**Cloudflare R2.** Rejected alternatives, briefly: the app's own disk (a
Hostinger redeploy wipes it — this is called out in the ROADMAP and is
non-negotiable); the database as blobs (bloats every backup and serves through
Node); S3 proper (egress is metered and a directory's photos are its bandwidth).
R2 has an S3-compatible API, a free tier well beyond this site's needs, and
**zero egress fees**, which is the property that matters for a photo-heavy
directory.

Bunny Storage would also be a defensible pick. Do not switch to it mid-PR — the
code below is written against the S3 API and one signing helper.

### 2.2 How the upload works

Add **`aws4fetch`** to `dependencies` (~5 kB, SigV4 over `fetch`, works against
R2). Not `@aws-sdk/client-s3`: it is tens of megabytes and Hostinger's install
already runs `--omit=dev` on a small box.

**Server-side upload through a server action**, not a browser-presigned PUT. The
file passes through the app so `sharp` can normalise it before it is ever stored
— a presigned direct upload puts whatever the browser had into the bucket,
including a 12 MB HEIC with the photographer's GPS coordinates in the EXIF.

Pipeline, in `lib/media/upload.ts`:

1. accept the `File` from `FormData`; reject >10 MB **before reading it**
2. reject anything whose sniffed type is not JPEG/PNG/WebP/AVIF — check the magic
   bytes, not the declared `Content-Type`, which the client controls
3. `sharp(buffer).rotate().resize({width: 1600, withoutEnlargement: true})
   .webp({quality: 82})` — `.rotate()` with no argument applies the EXIF
   orientation and then **drops the metadata**, which is how the GPS tag leaves.
   `sharp` is already a production dependency (added in Phase A).
4. PUT to `listings/<listingId>/<crypto.randomUUID()>.webp` with
   `Content-Type: image/webp` and a long `Cache-Control` (the key is unique, so
   it is immutable)
5. return the **key**, not a URL

Env (add to `.env.example`, documented in README, all five required together):

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
NEXT_PUBLIC_MEDIA_BASE_URL     # public bucket / CDN origin, no trailing slash
```

`mediaConfigured()` returns true only when all five are set, mirroring
`dbConfigured()`. Unset → the upload UI is replaced by the notice from open
question 1. The app must **boot and serve normally** without them.

### 2.3 What the DB column stores — decided

**The object key** (`listings/abc/def.webp`), not the full URL.

`listing_gallery.url` is `varchar(255)` and `listings.cover_image` likewise. If
the full URL is stored, moving to a CDN domain later is a hand-written UPDATE
over every row. Resolve at render time:

```ts
// lib/media/url.ts — pure, unit-tested
export function mediaUrl(stored: string): string {
  if (/^https?:\/\//.test(stored) || stored.startsWith('/')) return stored;  // legacy + seed
  return `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${stored}`;
}
```

The two escape hatches are load-bearing: the seed dataset stores
`/seed/*.svg` (first-party SVGs under `public/`) and those rows must keep
rendering unchanged after this PR. **Test both branches plus an unset base URL.**

Every existing render site for `coverImage` and `gallery` must be routed through
`mediaUrl()`. As of this writing they are:

- `app/(public)/lugar/[slug]/page.tsx` (cover + gallery)
- `components/ListingCard.tsx` (cover)
- `lib/jsonld.tsx` (the `image` property of the `LocalBusiness` JSON-LD — this
  one is easy to miss and a relative key there is invalid structured data)
- `components/CategoryBlock.tsx` / `components/detail/*` for `destacadoItem.image`
  and `productos[].image`

Re-grep rather than trusting this list; missing one leaves a broken image on the
live profile page.

### 2.4 Gallery management UI

On `/admin/negocios/[id]`, below the hours section:

- current images as thumbnails in `position` order, each with an `alt` text input
  (`varchar(200)`, optional but hinted: `Describí la foto. Ayuda a Google y a
  quien usa lector de pantalla.`)
- **Subir foto** — one file at a time, a plain server action. No drag-and-drop,
  no progress bar, no client component.
- **Mover** ↑/↓ and **Quitar** per image, each a form-submitting button
- a **Portada** action that sets `listings.cover_image` from a gallery key
- max 12 images per listing, enforced in the query module (not just the UI)

Positions are renormalised to `0..n-1` on every mutation, inside the transaction.
The unique index on `(listing_id, position)` means a naive swap collides
mid-update: delete-and-reinsert the whole set for that listing, exactly like
hours, rather than issuing two UPDATEs.

Query module functions (`lib/db/listings-admin.ts`, all `['admin','editor']`,
all logging to `activity_log` with `entityType: 'listing_gallery'`):

```ts
addGalleryImage(actor, listingId, key: string, alt: string | null, database?)
updateGalleryAlt(actor, listingId, imageId: number, alt: string | null, database?)
moveGalleryImage(actor, listingId, imageId: number, dir: 'up'|'down', database?)
removeGalleryImage(actor, listingId, imageId: number, database?)
setCoverImage(actor, listingId, key: string | null, database?)
```

Note every one takes **both** `listingId` and `imageId` and filters on both. An
image id alone is an object reference from the URL: filtering on it alone lets a
crafted id touch another listing's row. ROADMAP rule 4.

**Deleting a row does not delete the object.** Storage is cheap and an orphaned
object is recoverable; a deleted one is not. Say so in a comment so nobody
"fixes" it later.

### 2.5 The redeploy test — required before calling upload done

The ROADMAP demands this explicitly, and it is the single failure this whole
design exists to prevent:

1. upload a photo through the panel
2. redeploy the app (or, locally, delete `.next/` and the whole working tree's
   untracked files and rebuild)
3. **load the public profile page and confirm the photo still renders**

If it does not, the file went to the app's disk. State in the PR body that you
ran this, or — if the R2 credentials do not exist yet (open question 1) — state
plainly that it is **untested pending credentials**. Do not claim it passed.

---

## 3. `premiumUntil` and `verified` — admin only

These are the two fields PR-4 deliberately omitted.

They go in a **separate form section on the listing edit page**, rendered only
when `hasRole(actor, ['admin'])`, and written by a **separate query-module
function** guarded `['admin']`:

```ts
setListingFlags(actor, id: string, input: {verified: boolean; premiumUntil: number | null}, database?)
```

Two functions rather than widening `updateListing`, because that keeps the
editor-facing write path physically unable to set them — which is stronger than
any conditional inside one function, and it is what the tests assert.

- `verified`: `type: 'checkbox'`. Hint: `Marcá esto solo después de confirmar el
  negocio en persona o por teléfono.` It is a dated human assertion, not a
  computed flag (ROADMAP rule 8).
- `premiumUntil`: a `type: 'text'` date field, `YYYY-MM-DD`, empty = `null` = not
  premium. Parse in the pure module to **unix seconds at 23:59:59
  `America/Asuncion`** on that date — end of day, so "premium until the 31st"
  means the whole 31st. A past date is allowed (that is how you end a premium
  early) but the form shows `Esa fecha ya pasó.` as a **hint, not an error**.
  Render the stored value back as `YYYY-MM-DD` in the same timezone; a UTC
  round-trip drifts the date by one day for Asunción (UTC−3) and nobody notices
  until a premium expires a day early.

`isPremiumSql()` in `lib/db/listing-query.ts` already compares `premium_until`
against a passed-in `nowSeconds`. Reuse it; do not add a second definition of
"premium".

Audit: both flags log before/after. A `verified` flip is exactly the kind of
thing that has to be attributable months later.

---

## 4. Staleness / expiry dashboard

A section on `/admin` (not a new route), guarded `['admin', 'editor']`, four
counts each linking into `/admin/negocios` with the matching filter:

| Panel | Query |
|---|---|
| **Premium por vencer** | `premium_until` between now and now + 30 days, ascending — the one that is actually worth money |
| **Premium vencido** | `premium_until` < now, last 90 days |
| **Sin actualizar** | `updated_at` < now − 180 days (open question 2) |
| **Sin datos de contacto** | `phone`, `whatsapp`, `email` and `website` all NULL — a listing nobody can be contacted through is worse than no listing |

One query module function returning all four counts plus the top 5 rows of the
first, `['admin','editor']`-guarded. `nowSeconds` is computed in Node and passed
in — **nothing calls `NOW()`** (README: "Time is computed in the app, never by
MySQL"; the MySQL server's timezone is irrelevant and must stay that way).

Add the corresponding filters to `listListings` so the links land somewhere real:
`?estado=por-vencer|vencido|sin-actualizar|sin-contacto`.

---

## 5. Tests

Pure (`tests/validation.test.ts`, `tests/blocks.test.ts` style):

- hours: every rule in §1, especially **the midnight crosser, the 00:00 close and
  the siesta gap**
- `premiumUntil`: `YYYY-MM-DD` → unix seconds at end of day Asunción, and back
  again; empty → null; a malformed date is an error; **the round-trip does not
  shift the day**
- `mediaUrl()`: a key, an absolute URL, a `/seed/` path, and an unset base URL

Access (`tests/listings-admin-access.test.ts`, extended):

- `setListingFlags` with an `editor` actor **throws and the fake DB records no
  update** — not merely "an error came back"
- `updateListing` with an editor actor and a `FormData` carrying `verified=on`
  and `premiumUntil` leaves both columns untouched (the field-absence claim,
  actually asserted)
- every gallery and hours mutation with `actor = null` throws and writes nothing
- `moveGalleryImage`/`removeGalleryImage` with an `imageId` belonging to a
  **different** listing changes nothing and throws the **same** error as a
  non-existent id (ROADMAP rule 5 — different answers make the URL space an
  oracle)

> Run the canary check again: remove a `requireRole` and confirm these tests go
> red. Restore it. Say in the PR body that you ran it.

---

## 6. Definition of done

- [ ] Hours round-trip correct, including split days and midnight crossers,
      asserted through the same helpers the write path uses
- [ ] Upload strips EXIF and re-encodes to WebP; magic-byte type check
- [ ] Gallery stores keys; `mediaUrl()` handles seed paths; every render site
      routed through it
- [ ] **Redeploy test run and reported** — or explicitly reported as untested
      pending credentials
- [ ] `verified`/`premiumUntil` unreachable for an editor, asserted by a test
      that checks the row, not the error
- [ ] App boots and the panel works with the `R2_*` vars unset
- [ ] No new migration; `drizzle/` untouched
- [ ] `.env.example` + README updated with the five media vars
- [ ] `ROADMAP.md` PR-5 ticked with a "Shipped:" note in the same PR
