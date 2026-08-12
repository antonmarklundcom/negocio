# BUILD-SPEC — PR-4: core CRUD (listings, categories, cities, leads)

> Written for the session that implements PR-4. **Follow it; do not re-derive its
> decisions.** Where it says "decided", the alternative was considered and
> rejected for the stated reason.
>
> Read first: `ROADMAP.md` → Phase B (especially "Rules that do not bend"),
> `README.md` → Admin & auth, and the `usuarios` slice, which is the template
> this PR copies four times.

---

## Open questions — answer before merging, do not guess silently

1. **Who may read `/admin/leads`?** This spec says **`admin` only**, because a
   lead row carries a member of the public's name, phone and email, and the
   editor role is currently "content", not "customer data". If the intent is
   that editors work leads day to day, this is a one-word change in
   `listLeads()` — but make it deliberately, not by copying the listings guard.
2. **Deleting a category or city that still has listings.** Spec below refuses
   the delete and names the count. The alternative (reassign-then-delete) is
   more work than PR-4 is worth; if a rubro really has to go, the listings get
   moved first, one by one, which is also the audit trail.

Nothing else in this spec is uncertain.

---

## What PR-4 does NOT need

**No migration.** Every table and column this PR touches already exists in
`drizzle/0000_*` and `drizzle/0001_*`. `listings`, `listing_hours`,
`listing_gallery`, `categories`, `cities`, `leads` all shipped in PR-1. **Do not
run `db:generate`**; if you believe you need a new column, you have drifted from
this spec — stop and say so in the PR body instead.

This is what makes PR-4 safe to build and merge unattended: nothing here can
deploy ahead of a migration nobody applied.

**No new shared UI.** `AdminTable`, `AdminForm`, `AdminNav`, `lib/admin/validation.ts`
and `lib/db/activity-log.ts` all landed in PR-3 and are sufficient. In
particular, **do not add a new `FieldDef` variant** — see "JSON block fields"
below for how the awkward inputs fit the existing five types.

**No hours editor, no gallery upload, no `verified`, no `premiumUntil`.** Those
are PR-5. Their absence from every `fields.ts` in this PR *is* the enforcement
that an editor cannot set them (ROADMAP rule: "hidden buttons are UX, not access
control" — a field that does not exist cannot be posted).

---

## Files this PR adds

```
lib/db/listings-admin.ts       query module — listings CRUD
lib/db/taxonomy-admin.ts       query module — categories + cities CRUD
lib/db/leads-admin.ts          query module — leads, read-only
lib/admin/blocks.ts            pure parse/serialise for the JSON block fields
app/admin/negocios/{page.tsx,fields.ts,actions.ts,nuevo/page.tsx,[id]/page.tsx}
app/admin/rubros/{page.tsx,fields.ts,actions.ts,nuevo/page.tsx,[slug]/page.tsx}
app/admin/ciudades/{page.tsx,fields.ts,actions.ts,nuevo/page.tsx,[slug]/page.tsx}
app/admin/leads/page.tsx
tests/listings-admin-access.test.ts
tests/taxonomy-admin-access.test.ts
tests/blocks.test.ts
(+ cases appended to tests/validation.test.ts)
```

Changed: `lib/admin/validation.ts` (four new parsers), `components/admin/AdminNav.tsx`
(four links), `app/admin/page.tsx` (counts), `ROADMAP.md` + `README.md`.

Route slugs are Spanish to match the rest of the panel: `negocios`, `rubros`,
`ciudades`, `leads`.

---

## Rules restated, because these are the ones that get dropped

- `requireRole()` is the **first statement** of every exported function in every
  new query module, before any DB call — not in the server action.
- Every function takes `database: Db = getDb()` as its **last** parameter, so a
  test can inject a fake and assert a rejected call wrote nothing.
- Every write calls `logActivity(tx, …)` **inside the same transaction**.
- No SQL outside `lib/db/`.
- `export const dynamic = 'force-dynamic'` on every new admin route.
- Server components everywhere; `AdminForm` stays the only client component.
- Validation stays pure: `FormData` in, `{ok,data} | {ok:false,errors}` out.

---

## 1. Listings — `/admin/negocios`

### Guard

`['admin', 'editor']` on every function. Listings are the editor's whole job.

### `fields.ts` — `listingFields(mode, categories, cities)`

The taxonomy options are passed in, not imported: the form must offer what is in
the **database**, not what is in `lib/categories.ts`, or an editor can pick a
rubro that no longer exists and the FK rejects the insert with a 500.

| # | name | type | required | max | notes |
|---|---|---|---|---|---|
| 1 | `name` | text | yes | 200 | |
| 2 | `slug` | text | **create only** | 191 | See "slug" below. Absent in `update`. |
| 3 | `categoria` | select | yes | — | `placeholder: '— Elegí un rubro —'`, options from DB |
| 4 | `ciudad` | select | yes | — | `placeholder: '— Elegí una ciudad —'`, options from DB |
| 5 | `subtitle` | text | no | 200 | hint: `Ej. "Cocina paraguaya"` |
| 6 | `description` | textarea | no | 2000 | rows 6 |
| 7 | `zona` | text | no | 120 | hint: `Barrio. Ej. "Villa Morra"` |
| 8 | `address` | text | no | 255 | |
| 9 | `lat` | text | no | — | See "coordinates" below — **text, not number** |
| 10 | `lng` | text | no | — | idem |
| 11 | `phone` | text | no | 40 | |
| 12 | `whatsapp` | text | no | 20 | hint: `Solo dígitos, con código de país: 595981123456` |
| 13 | `email` | email | no | 160 | optional — the shared `requireEmail` is for users; write an `optionalEmail` |
| 14 | `website` | url | no | 255 | |
| 15 | `instagram` | text | no | 80 | hint: `Solo el usuario, sin @ ni URL` |
| 16 | `especialidades` | textarea | no | 1000 | block field — see §1.4 |
| 17 | `productos` | textarea | no | 2000 | block field |
| 18 | `servicios` | textarea | no | 2000 | block field |
| 19 | `destacadoTitle` | text | no | 120 | block field |
| 20 | `destacadoDesc` | textarea | no | 400 | block field |
| 21 | `destacadoPrice` | text | no | 60 | block field |

**Absent on purpose, and this is the enforcement:** `verified`, `premiumUntil`,
`rating`, `reviewsCount`, `yearsActive`, `avgResponseMins`, `coverImage`,
gallery, hours, `id`. The first two are PR-5's, behind `admin`. `rating` and
`reviewsCount` are never free-text admin fields at all (ROADMAP rule 8 — the
whole reviews UI is honesty-gated; a hand-typed 4.7 is a fabricated fact).

`destacadoItem.image` is omitted here because it is an upload, which is PR-5.
The other three destacado fields are plain text and land now.

### 1.1 slug

**Decided: the slug is set at create and is not editable afterwards.** It is a
public URL (`/lugar/[slug]`), it is in the sitemap and it is what
`import-seed.ts` keys on. An edit form that silently 301-less-ly changes a live
URL is a worse outcome than a typo that has to be fixed by creating a new row.

- On create: default it from `name` in the **form field's placeholder/hint only**
  — do not auto-fill server-side, because a slug that appears by magic is a slug
  nobody checked.
- Validation: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, ≤191 chars, and a
  `isListingSlugTaken()` pre-check exactly like `isEmailTaken()` (same
  `requireRole` guard, same "already exists" field error, not a 500 on the unique
  index).

### 1.2 `listings.id`

Not a form field. Generated at create as `crypto.randomUUID()`. It is a
`varchar(64)` primary key that must be stable forever; deriving it from the slug
would couple the identity to a public URL.

### 1.3 coordinates

`lat`/`lng` are `decimal(9,6)` and **nullable, both or neither**.

Use `type: 'text'`, not `'number'` — a browser number input with a comma decimal
separator (which is the Paraguayan keyboard default) submits an empty string, so
the coordinate silently vanishes. Parse it yourself:

- empty → `null` (allowed; the map falls back to the city centre at render time)
- accept `-25,29` and `-25.29`; normalise the comma to a dot
- `lat` ∈ [-90, 90], `lng` ∈ [-180, 180], else a field error
- **one set without the other is a validation error** on the missing one:
  `Poné las dos coordenadas o ninguna.`

Never write the city-centre fallback back into the row. `rowToListing` applies it
at render time as a *display* decision; persisting it would turn "we don't know
where this business is" into "this business is at the town square".

### 1.4 JSON block fields — `lib/admin/blocks.ts`

`especialidades`, `productos`, `servicios` and `destacadoItem` are JSON columns
(render-only, nothing filters on them). They are edited as **plain textareas,
one item per line**, and parsed by a new pure module so the round-trip is
unit-testable without MySQL.

**Decided: textareas over a new repeatable `FieldDef`.** A repeatable field means
client-side add/remove rows, which means a second client component, which means a
second validation style outside the pure module — the exact thing PR-3's
`AdminForm` comment warns against. One line per item is uglier and correct.

| field | line format | parses to |
|---|---|---|
| `especialidades` | `Empanadas` | `string[]` |
| `servicios` | `Título \| descripción` (desc optional) | `{title, desc?}[]` |
| `productos` | `Título \| precio` (price optional) | `{title, price?}[]` |
| `destacadoItem` | three separate flat fields | `{title, desc?, price?}` |

Exports, all pure:

```ts
parseLines(raw: string): string[]                       // trims, drops empties
parsePipedLines(raw: string, keys: readonly string[]): Record<string,string>[]
serialiseLines(v: string[] | null): string
serialisePiped(rows: Record<string,string>[] | null, keys: readonly string[]): string
```

Rules: `|` splits at most `keys.length` columns (a description containing a pipe
keeps the remainder); blank lines are dropped; an item whose **first** column is
empty is a validation error naming the line number — not silently dropped, or an
editor loses content and is never told. Empty textarea → `null`, never `[]`, so
"no especialidades" and "an empty list" stay the same thing in the column.

`destacadoItem` is `null` unless `destacadoTitle` is non-empty. If a price or
description is filled but the title is not, that is a field error on the title —
a block with no title cannot render.

### 1.5 Query module — `lib/db/listings-admin.ts`

```ts
export const LISTINGS_PAGE_SIZE = 25;

export interface AdminListingRow {
  id: string; slug: string; name: string;
  categoria: string; categoriaLabel: string;
  ciudad: string;    ciudadLabel: string;
  verified: boolean; premiumUntil: number | null;   // displayed, not editable
  updatedAt: Date;
}

listListings(actor, params: {q?, categoria?, ciudad?, page?}, database?)
  : Promise<{rows: AdminListingRow[]; total; page; pageSize}>
getListingForEdit(actor, id: string, database?): Promise<AdminListingForm | null>
isListingSlugTaken(actor, slug: string, exceptId: string | null, database?): Promise<boolean>
createListing(actor, input: ListingFormInput, database?): Promise<string>   // returns the new id
updateListing(actor, id: string, input: ListingFormInput, database?): Promise<void>
deleteListing(actor, id: string, database?): Promise<void>
```

- `listListings` joins `categories`/`cities` for the labels and orders by
  `desc(listings.updatedAt)` — the admin's question is "what did we touch
  lately", not "what is alphabetically first". `q` is `like` over `name` and
  `slug`. Filters compose with `and`.
- `getListingForEdit` returns the **row**, not a `Listing` — do not reuse
  `rowToListing`, which fills derived display fields (`categoriaLabel`,
  `logoInitial`, the city-centre coordinate fallback) that must never be echoed
  back into a form and re-saved as data.
- `createListing`/`updateListing` write only the columns in the field table
  above. On update, **do not touch** `verified`, `premiumUntil`, `rating`,
  `reviewsCount`, `coverImage`, hours or gallery — build the `set` object
  explicitly, field by field. A spread of the parsed input is how those get
  nulled out by a form that never showed them.
- `deleteListing` is guarded `['admin']`, not `['editor']`. It cascades to
  `listing_hours` and `listing_gallery` (FK `onDelete: 'cascade'`), which is
  unrecoverable; that is an admin's call. Log `action: 'delete'` with the full
  before-snapshot inside the transaction.
- Audit snapshots: the whole editable field set, via a local `auditView()` like
  the users module's. Listings hold no credential, so nothing needs redacting —
  but write the projection anyway so the log stays stable when columns are added.

### 1.6 List page

Columns: **Negocio** (name + slug beneath, muted), **Rubro** (label),
**Ciudad** (label), **Estado** (`Premium` / `Verificado` chips when true —
read-only display), **Actualizado** (`updatedAt`, `America/Asuncion`).

`editHref: (row) => \`/admin/negocios/${row.id}\``.
`emptyLabel`: `Todavía no hay negocios cargados.` — and when a search is active,
`No encontramos negocios para "…".` Honest, context-specific (AdminTable's own
comment says never "No results").

Search is `<form method="GET">` with `q`, plus two `<select>` filters
(`categoria`, `ciudad`) that submit with it. Pagination is a link.
`buildPageHref` must **preserve `q`, `categoria` and `ciudad`** — dropping the
filter on page 2 is the classic bug here.

---

## 2. Categories — `/admin/rubros`

### Guard

`['admin', 'editor']` for read/create/update. `['admin']` for delete.

### Fields — `categoryFields(mode)`

| name | type | required | notes |
|---|---|---|---|
| `slug` | text | create only | Same slug rule as listings; **never editable** — it is a public URL (`/[categoria]`) and an FK target for every listing. |
| `label` | text | yes | max 120 |
| `labelPlural` | text | yes | max 120, hint: `Se usa en las páginas de rubro. Ej. "Restaurantes y cafés"` |
| `icon` | select | yes | Options are the icon keys `components/icons.tsx` actually resolves — **export the key list from that module and build the options from it; do not offer free text.** A typo here renders a missing icon on the live category page. |
| `blockKind` | select | yes | `BLOCK_KINDS` from `lib/db/schema` (`food`/`shop`/`service`/`default`), placeholder `— Elegí un tipo —`, hint explaining it picks the premium profile block |
| `sortOrder` | number | yes | min 0, hint: `La taxonomía es curada, no alfabética.` |

### Query module — `lib/db/taxonomy-admin.ts` (categories half)

```ts
listCategories(actor, params: {q?, page?}, database?)
getCategory(actor, slug, database?)
isCategorySlugTaken(actor, slug, database?)
createCategory(actor, input, database?)
updateCategory(actor, slug, input, database?)
deleteCategory(actor, slug, database?)
countListingsByCategory(actor, database?): Promise<Record<string, number>>
```

- Order by `asc(sortOrder), asc(label)` — the curated order is the point.
- `deleteCategory` **counts listings first, inside the transaction**, and throws
  `AuthError('No podés borrar un rubro con N negocios. Movelos primero.', 'forbidden')`
  when non-zero. The FK is `onDelete: 'restrict'`, so the DB would reject it
  anyway — this exists so the editor gets a sentence instead of a 500.
- `entityId` for the audit log is the **slug** (this is exactly why
  `activity_log.entity_id` is a VARCHAR).

### List page

Columns: **Rubro** (label + slug), **Plural**, **Bloque** (`blockKind` label),
**Orden** (numeric), **Negocios** (count from `countListingsByCategory`).

`AdminTable` requires `Row extends {id: number | string}`. Categories are keyed on
slug, so the row objects passed to it must carry **`id: row.slug`**. Map it in
the page; do not widen `AdminTable`.

---

## 3. Cities — `/admin/ciudades`

Identical shape, same module, `['admin','editor']` / `['admin']` for delete.

Fields: `slug` (create only), `label` (required, 120), `sortOrder` (number,
required, min 0), `lat`, `lng` (text, optional, same coordinate parser as
listings — both or neither).

The city coordinate is the **map fallback** for listings without their own, so a
wrong one is wrong on many pages at once. Hint it: `Centro de la ciudad. Se usa
como referencia en el mapa para negocios sin coordenadas propias.`

`deleteCity` refuses with a count, exactly like categories.

List columns: **Ciudad** (label + slug), **Orden**, **Coordenadas**
(`lat, lng` or the em-dash `—` when unset — never `0, 0`), **Negocios**.

---

## 4. Leads — `/admin/leads` (read-only)

No create, no update, no delete. The list page is the only surface.

```ts
export const LEADS_PAGE_SIZE = 50;
listLeads(actor, params: {source?, q?, page?}, database?)
  : Promise<{rows: LeadRow[]; total; page; pageSize}>
```

Guard `['admin']` — see open question 1.

Order by `desc(leads.createdAt)`. `source` filter from `LEAD_SOURCES`. `q` is
`like` over `name`, `contact`, `email`, `phone`, `businessName`.

Columns: **Fecha** (`createdAt`, `America/Asuncion`, date + time), **Origen**
(a Spanish label per `LEAD_SOURCES` — add `LEAD_SOURCE_LABELS` to
`lib/admin/labels.ts`), **Contacto** (`name` + the best of
`contact`/`email`/`phone`), **Negocio** (`listingSlug` linked to
`/admin/negocios/…` when it still resolves, else the raw slug — a lead outlives
its listing by design), **Mensaje** (truncated to ~80 chars), **Entrega**
(`deliveredSinks/configuredSinks`; when `configuredSinks` is 0 render
`Sin webhooks` — that is the true state before the envs are set, not a failure).

`AdminTable` wants `editHref`; there is nothing to edit. Render the leads table
directly rather than passing a dead link — a row that looks clickable and does
nothing is worse than a plain table. Keep the same markup/classes so it reads as
one panel.

---

## 5. Dashboard + nav

`app/admin/page.tsx`: add counts (negocios, rubros, ciudades, leads this month)
next to the existing recent-activity list. Each count is a guarded call in the
relevant query module — no ad-hoc SQL in the page.

`AdminNav`: add **Negocios**, **Rubros**, **Ciudades**, **Leads**. Leads is
hidden from editors if open question 1 lands on admin-only — and the guard in
`listLeads` is what actually stops them.

---

## 6. Tests

Add to `tests/validation.test.ts` (pure, no DB):

- every required field missing → its own error, **all accumulated in one object**
- slug: valid, uppercase, spaces, leading/trailing hyphen, >191 chars
- coordinates: empty pair ok; comma decimal accepted; out-of-range rejected;
  **lat without lng rejected and vice versa**
- optional email: empty ok, malformed rejected
- an unselected `categoria`/`ciudad`/`blockKind` select fails (it must be able to
  be empty and must not default)

`tests/blocks.test.ts` (new, pure):

- `parseLines` / `parsePipedLines`: blank lines dropped, whitespace trimmed,
  a description containing `|` survives, an item with an empty first column is an
  error naming the line
- **round-trip**: `parse(serialise(x)) === x` for each block field, including
  `null` → `''` → `null`

`tests/listings-admin-access.test.ts` and `tests/taxonomy-admin-access.test.ts`
(new), following `tests/users-access.test.ts`:

- every mutation called **directly against the query module** with `actor = null`
  throws `AuthError('unauthenticated')`
- every mutation with an `editor` actor: allowed for listings/categories/cities
  create+update; **rejected for every delete**
- an `owner_admin` actor is rejected everywhere (the enum values exist; they
  satisfy nothing staff-facing)
- `deleteCategory`/`deleteCity` with listings attached throws and the fake DB
  records **no delete**

> **Canary check — run it, do not just write the tests.** Delete a `requireRole`
> line locally and re-run the access tests. If they still pass, they are
> asserting "an error came back" and a validation error satisfied them. Rewrite
> them to attempt the write and assert the injected fake recorded **no
> insert/update/delete**. This exact failure shipped on educacion. Restore the
> guard afterwards and say in the PR body that you ran it.

CI must be green on `typecheck`, `test`, `build` **and the `production-build`
job** (`npm ci --omit=dev` under `NODE_ENV=production`) before merge. If you add
a tooling-only file, it belongs in `tsconfig.json`'s exclude list and
`tsconfig.typecheck.json`'s include — see README → "The production build has no
devDependencies".

---

## 7. Copy

Paraguayan voseo throughout the UI: *elegí, poné, movelos, guardá, tenés*.
Money as `Gs. 1.450.000`. Code, comments, commit message and PR body in English.

---

## 8. Definition of done

- [ ] All four slices reachable from `/admin`, each 404-ing for the unauthorised
- [ ] Every mutation guarded inside the query module, verified by the canary run
- [ ] No new migration; `drizzle/` untouched
- [ ] `AdminForm`/`AdminTable` unchanged (no new `FieldDef` variant)
- [ ] `ROADMAP.md` PR-4 checkbox ticked with a "Shipped:" note in the same PR
- [ ] `README.md` → "What is not built yet" updated to name only PR-5's items
