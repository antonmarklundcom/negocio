# negocio.com.py

A fast, warm, trustworthy **business directory for Paraguay**. Everyday people
find local businesses (restaurants, shops, services, clinics…) and contact them
for free; businesses get listed for free with a premium upgrade.

- **Stack:** Next.js (App Router) + TypeScript (strict) + Tailwind CSS.
- **Rendering:** SSR / Server Components for all listing data — never client-side
  `useEffect` fetching for listings.
- **Maps:** MapLibre GL with keyless tiles (OpenFreeMap / CARTO Positron),
  lazy-loaded so they never weigh down first paint.
- **Locale:** Spanish (Paraguay), ₲ (PYG), `America/Asuncion`.

The site **runs and looks complete on built-in seed data** with only the
minimum env block set. Every backend/integration activates by adding its env and
redeploying.

---

## Quick start

```bash
cp .env.example .env.local      # the MINIMUM block is enough to run
npm install
npm run dev                     # http://localhost:3000
npm run build && npm run start  # production
npm run typecheck               # strict TS, no emit
npm run test                    # vitest — pure tests, no MySQL needed
```

---

## Project layout

```
app/                       Routes (App Router) — TWO root layouts, see below
  (site)/                  The public site. Group is NOT part of any URL.
    [locale]/              es (unprefixed) | en → /en/…  (see "Languages")
      layout.tsx           <html lang>, fonts, analytics, NextIntlClientProvider
      (public)/            Header / footer / bottom nav / promo banner
        page.tsx           Home
        buscar/            Search results (filters, list/map)
        [categoria]/       Category landing (all cities)
        [categoria]/[ciudad]/  Programmatic SEO landing
        lugar/[slug]/      Business detail (Free & Premium = one template)
        favoritos/         Saved businesses — localStorage, rendered server-side
                           from ?ids= (see lib/favorites.ts), noindex
        precios, sumar-negocio, contacto, nosotros
    not-found.tsx          The 404 (shares its body with the panel's — see below)
  (panel)/                 Staff only, Spanish only, OUTSIDE the locale segment
    layout.tsx             <html lang="es-PY">, fonts, no analytics
    (auth)/                ingresar · cambiar-contrasena (bare chrome)
    admin/                 First-party staff panel (see "Admin & auth")
    not-found.tsx          Byte-identical head+body to the site's 404
  api/v1/listings          GET list (zod-validated)
  api/v1/listings/[slug]   GET one
  api/v1/leads             POST single lead orchestrator
  api/v1/reviews           POST public review submission (lands as `pending`)
  sitemap.ts, robots.ts    Generated from the listings repo
components/                UI (cards, pills, maps, forms, detail blocks)
  admin/                   AdminTable · AdminForm · AdminNav (the whole panel UI)
lib/                       Domain logic
  listings-repo.ts         THE single data-access surface (the seam)
  providers/               seed.ts · db.ts · query.ts (shared filtering)
  db/                      schema.ts · client.ts · mappers.ts · listing-query.ts ·
                           leads.ts · reviews.ts · reviews-admin.ts · users.ts ·
                           activity-log.ts
  reviews.ts               Review submission contract + rating roll-up (pure)
  public-write.ts          requirePublicWrite() — the public-form guard
  rate-limit.ts            In-memory per-IP limiter — SINGLE PROCESS (see below)
  auth/                    session.ts · roles.ts · password.ts · login.ts
  admin/                   validation.ts (pure) · labels.ts
  i18n/                    routing.ts (locales, prefix policy) · request.ts ·
                           alternates.ts (canonical + hreflang) · metadata.ts ·
                           navigation.ts (server-safe) · link.tsx ('use client')
  types.ts, config.ts, categories.ts, cities.ts, hours.ts, format.ts, fonts.ts
  leads.ts                 Lead orchestrator (zod + fan-out)
  mail.ts                  Env-gated SMTP transport (unset → feature off)
  admin/digest.ts          Expiry-digest wording (pure)
  jsonld.tsx               schema.org builders
messages/                  es.json · en.json — nav/chrome strings only (W3-3)
middleware.ts              Locale routing for the public site only
drizzle/                   Generated SQL migrations (applied from a local machine)
scripts/import-seed.ts     Idempotent seed → MySQL import (tsx)
scripts/bootstrap-admin.ts Creates the first administrator, once (tsx)
tests/                     vitest — pure, no database
e2e/smoke.spec.ts          Playwright smoke suite (no database)
e2e/admin.spec.ts          Playwright admin round-trip (needs MySQL)
design/                    Approved visual reference + the brief behind it
                           (see design/README.md)
legacy/                    The previous static prototype (kept for reference)
public/seed/               First-party SVG placeholder photos (never hotlinked)
```

---

## The repository seam — how to swap the backend

**`lib/listings-repo.ts` is the only place that touches data.** Every page and
API route imports from it; nothing else calls WordPress or `fetch` directly.

It selects a **provider** (`lib/providers/*`) that implements one interface
(`lib/providers/types.ts`):

```ts
getListings(params)                       // filters + pagination
getListingBySlug(slug)
getCategories() / getCities()
getCategoryCityCombosWithListings()       // SEO pages + sitemap
```

Selection logic (in `listings-repo.ts`):

- `DATABASE_URL` set (`dbConfigured()`) → **MySQL** (`lib/providers/db.ts`).
- otherwise → **seed** (`lib/providers/seed.ts` — the local-dev path, and the
  importer's source of truth).

There is **no fallback**: a DB error surfaces to the caller instead of
silently serving stale seed data. That is deliberate — a page that renders
wrong is loud; a page that quietly renders stale data is not.

### Swapping the backend later

1. Add a provider under `lib/providers/` implementing `ListingsProvider`.
2. Change the **one** `selectPrimary()` line in `listings-repo.ts`.
   Nothing else in the app changes.

---

## Languages (es-PY default, /en)

Spanish is the default and carries **no prefix**: `/`, `/buscar`,
`/restaurantes/asuncion` are exactly the URLs they always were. English is
additive at `/en/…`, and **slugs stay Spanish** — `/en/restaurantes/asuncion`,
never `/en/restaurants/asuncion` (ROADMAP D1).

Three things are worth knowing before touching this:

**1. There are two root layouts, and it is deliberate.** `app/(site)/[locale]/`
owns `<html lang>` for the public site; `app/(panel)/` owns it for `/admin` and
`/ingresar`, which are Spanish-only and live outside the locale segment. The
obvious alternative — one shared root reading `getLocale()` — was built, and it
turned every ISR'd public page dynamic, because `getLocale()` is a dynamic
request API. Reading the locale from the route *segment* keeps the pages static.
Both roots must keep rendering the **same** default metadata
(`lib/i18n/metadata.ts`): the panel's only anonymous-reachable page is its 404,
and a different `<title>` there would confirm `/admin` exists to anyone who
asked.

**2. The locale is threaded explicitly. Do not rely on the ambient one.**
next-intl's request-scoped locale (`setRequestLocale` / bare
`getTranslations()` / the server build of `Link`) does not propagate reliably in
this app, and `next/root-params` cannot help while the panel has its own root
layout. So: `NextIntlClientProvider` is given an explicit `locale` and
`messages`, server components call `getTranslations({ locale, namespace })`, and
**every internal public link comes from `lib/i18n/link.tsx`** (a `'use client'`
module that reads the provider). A plain `next/link` on `/en` navigates to the
Spanish page. This costs no extra client JS — `next/link` is a client component
already.

**3. Anything dynamic in the header costs the whole site its ISR.** The header
is in every public page's layout, so a dynamic API there (e.g.
`useSearchParams` in the language switcher) opts every page out of static
rendering. Keep such things behind a `<Suspense>`; `LanguageSwitcherSlot` is the
pattern.

Adding a locale (Guaraní is deferred, D1) is one entry in `routing.locales`, one
`messages/<locale>.json`, one sibling of `EN_CATEGORY_LABELS`, and one entry
each in `HTML_LANG` / `OG_LOCALE` / `LOCALE_LABEL`. The key-parity test in
`tests/i18n.test.ts` fails first if a message is missed, and
`untranslatedCategories()` fails if a rubro is.

**Where the strings live.** Every user-facing string on the public site is in
`messages/*.json` (14 namespaces). Two rules kept while extracting them:

- **Counted sentences are one ICU message**, not `count + ' negocio' + (s)` —
  see `landing.categoryLead`, `favorites.savedCount`. Spanish and English agree
  on one-vs-many; the next locale may not.
- **A sentence with variants is several whole messages**, not one message with
  a translated fragment glued into it. "opens tomorrow at 8" and "opens Monday
  at 8" are `hours.opensTomorrow` and `hours.opensOnDay`, because word order
  around an inserted day name is not universal. `/buscar`'s title is the single
  deliberate exception and says so in a comment.

`lib/hours.ts` deliberately contains **no language**: it returns `opensDay` +
`opensWhen`, and `formatRanges` returns `null` rather than the word "Cerrado".
The UI names them. The staff panel keeps its own Spanish day labels — it is
Spanish-only, and those are validation messages, not display copy.

**Known limitation:** the 404 body always renders in the default locale, so
`/en/nada` shows an English header around a Spanish 404. `not-found.tsx`
receives no props; `components/NotFoundBody.tsx` records what was tried and why
it was reverted.

**`revalidatePublic()` is per-locale.** `revalidatePath('/', 'layout')` matches
nothing now that the public site lives under `[locale]`; it loops over
`routing.locales` instead. A new locale that skipped this would serve stale
listing pages for an hour after every staff edit, silently.

---

## Database (MySQL + Drizzle)

Schema: `lib/db/schema.ts`, derived from `lib/types.ts` — never from a CMS's
field names. Nine tables: `listings`, `listing_hours`, `listing_gallery`,
`categories`, `cities`, `leads`, `reviews`, `users`, `activity_log`.

Two shape decisions, fixed in the schema and expensive to change afterwards:

- `hours` and `gallery` are **child tables**, because they are queried — hours
  drives "Abierto ahora" in a `WHERE` clause, gallery is ordered.
- `especialidades` / `productos` / `servicios` / `destacadoItem` are **JSON
  columns**, because they are render-only and nothing filters on them.

**No SQL lives outside `lib/db/` and `lib/providers/db.ts`.** Components and
pages get plain `Listing` / `Category` / `City` objects.

### Migrations are applied from a local machine

Generated into `drizzle/` and committed; **never** applied by a deploy hook or
a web session. Any PR whose code needs a new column must land *after* that
column has been applied, or it deploys and 500s.

```bash
# 1. point at the database (tsx and drizzle-kit do NOT read .env)
export DATABASE_URL="mysql://user:password@host:3306/database"

# 2. apply the committed migrations
npm run db:migrate

# 3. import the seed dataset — idempotent, keyed on slug, safe to re-run
npm run db:import-seed -- --dry-run    # prints counts, writes nothing
npm run db:import-seed

# after changing lib/db/schema.ts, generate a new migration and commit it
npm run db:generate
```

On Hostinger the database host must have the app's IP whitelisted under
hPanel → Databases → **Remote MySQL**, and `DATABASE_URL` set in the Node.js
app's env panel.

### Time is computed in the app, never by MySQL

"Abierto ahora" is `America/Asuncion` wall-clock time. The current day and
minute are computed in Node (`lib/db/open-now.ts`) and passed into the query as
parameters; nothing calls `NOW()` or `CURDATE()`. The MySQL server's timezone
is irrelevant and must stay that way.

---

## Admin & auth

The panel lives at **`/admin`** and replaces the need for any external CMS. Sign
in at `/ingresar`. It requires **both** `DATABASE_URL` and `SESSION_SECRET`;
without them `/admin` 404s, which is also why local dev on seed data has no
panel at all.

### Setting it up (once, from a local machine)

```bash
export DATABASE_URL="mysql://user:password@host:3306/database"
npm run db:migrate                                   # applies drizzle/0001_* (users, activity_log)

openssl rand -base64 32                              # → SESSION_SECRET in the app env panel, then redeploy

npm run bootstrap-admin -- --email vos@negocio.com.py --name "Tu Nombre"
```

`bootstrap-admin` prints a random password **once**, sets
`must_change_password`, and **refuses to run if an active admin already
exists** — otherwise it would be a shell backdoor for minting admins that
bypasses the panel's own audit log. Every further account is created from
`/admin/usuarios`, where it is logged.

### The rules this code is built on

1. **`requireRole()` is the first statement of every function in
   `lib/db/users.ts`**, before any database call. The `/admin` layout guard is a
   **backstop**: a server action is reachable over HTTP without the layout ever
   rendering, and Next.js does not re-run a layout for one.
2. **Hidden buttons are UX, not access control.** The "Usuarios" link is hidden
   from editors; the guard that stops them is in the query module.
3. **No SQL outside `lib/db/`.** Pages get plain typed objects.
4. **Every write logs before/after to `activity_log` inside the same
   transaction** as the mutation — called from the query module, never a route.
   Snapshots never contain a credential.
5. **Validation is pure** (`lib/admin/validation.ts`): `FormData` in,
   `{ok,data} | {ok:false,errors}` out. No DB, no session, no clock — which is
   what lets every rule be tested without MySQL.
6. **Server components by default.** `AdminForm` is the only client component in
   the entire panel (`useFormState` keeps typed values on the page when
   validation fails). Pagination is a link; search is `<form method="GET">`.
7. **`/admin` 404s for the unauthorised, never 403.** "This exists but you may
   not see it" is itself information.
8. **`export const dynamic = 'force-dynamic'` on every admin route.** A session
   is per-request; without it a guard added to a static page never runs.

### Decisions worth not re-litigating

- **scrypt from `node:crypto`, not bcrypt.** bcrypt is a native module compiled
  against the Node ABI; on Hostinger's managed Node a platform upgrade turns
  every login into a 500 until someone SSHs in and rebuilds. Hashes are stored
  self-describing as `scrypt$N$r$p$salt$key`, so parameters can be raised later
  and existing hashes upgrade transparently on next login. `maxmem` is raised
  explicitly — Node's 32 MB default is below what N=2¹⁷ needs.
- **Every login failure returns one identical message.** Unknown email, wrong
  password, no password set, suspended. The unknown-email path hashes against a
  cached decoy, and "suspended" is checked *after* the password, so response
  time is not an account-enumeration oracle. The real reason goes to the log.
- **The session cookie carries only** id, role, scope id,
  `mustChangePassword` and the instant it was issued; 8-hour TTL, `httpOnly`,
  `sameSite: lax`, `secure` in production.
- **`currentUser()` re-reads the account from the database on every request**
  (ROADMAP W1-2), so suspending or demoting somebody takes effect on their
  next request rather than whenever their cookie happens to expire. `role` and
  `mustChangePassword` come back from the ROW, not from the cookie. It returns
  null for a cookie that opens cleanly when the account is gone, is suspended,
  or was issued before the account's password last changed.
  *This claim used to be in this README while the code did not do it* — the
  cookie was the whole answer and a suspended admin kept working for up to
  eight hours. W1-2 made the code match the documentation.
  The decision itself is pure and lives in `lib/auth/session-check.ts`, so it
  is tested without a cookie, a database or a clock. `sessionClaims()` is the
  unverified cookie payload and has exactly two legitimate callers: the login
  flow and `currentUser()` itself.
- **A database blip signs staff out** rather than serving the admin from an
  unverified cookie. That is a deliberate trade: the public site never calls
  `currentUser()`, so a blip cannot take the site down, and fail-closed is the
  only defensible default for the thing that decides who may write.
- **Changing a password revokes every other session** for that account
  (`users.password_changed_at`, compared against the cookie's issue time). The
  tab that performed the change re-issues its own cookie and survives; the
  stolen laptop still holding a valid cookie does not, which is the whole
  reason somebody changes their password under duress. An admin-issued reset
  does the same.
- **No default password anywhere.** Admin-issued resets generate a random one
  and return it as a one-time on-screen notice — deliberately not a redirect
  carrying it in a query string, which would land in access logs and history.
- **Roles are a satisfaction map, not a numeric ladder.** `admin` satisfies
  `admin` + `editor`. The `owner_*` values exist in the enum (reserved for the
  owner portal) but satisfy nothing staff-facing and cannot be assigned from any
  form — with a numeric ladder, `owner_admin >= editor` would hand an owner a
  staff screen.
- **Password reset by email is live** (`/recuperar-contrasena` →
  `/restablecer-contrasena`), which clears half the owner-portal gate; the other
  half is ≥20 paying businesses. Four rules hold it up. The raw token is never
  stored — the database keeps its SHA-256, so a leaked backup yields nothing
  usable. Requesting a link answers **identically** for a real address, an
  unknown one and a suspended account, so the form is not a staff directory.
  Spending a token is a single `UPDATE ... WHERE used_at IS NULL` whose
  affected-row count authorises the password write, so two requests carrying the
  same link cannot both win. And a successful reset does **not** sign you in: an
  email link should not be a session, so it stamps `password_changed_at` (which
  revokes every open session) and sends you to `/ingresar` to use what you just
  chose. SMTP unconfigured is reported plainly rather than faked as sent — that
  message is the same for every address, so it enumerates nobody.

### What is not built yet

Phase B (native backend) is complete as of PR-5: listing / category / city CRUD,
a read-only `/admin/leads` list, the hours editor, gallery upload, `premiumUntil`
and `verified`. See ROADMAP Phase D for what comes next.

---

## Media (Cloudflare R2)

Listing photos (gallery + cover) are uploaded through a server action, never a
browser-presigned direct PUT — the file passes through the app so `sharp` can
strip EXIF (including GPS) and re-encode to WebP before anything is stored. See
`lib/media/upload.ts`.

**The database column stores the object KEY** (`listings/abc/def.webp`), never
the full URL — moving to a different CDN origin later is a one-line env change,
not a hand-written `UPDATE` over every row. `lib/media/url.ts`'s `mediaUrl()`
resolves a stored value at render time and has two escape hatches that must
keep working: an absolute URL (legacy data) and a root-relative `/seed/*.svg`
path (the first-party seed placeholders in `public/`).

Five env vars, **required together** (`mediaConfigured()` checks all five):

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
NEXT_PUBLIC_MEDIA_BASE_URL     # public bucket/CDN origin, no trailing slash
```

**The R2 bucket does not exist yet.** Until these five are set, the gallery
section on `/admin/negocios/[id]` shows "Falta configurar el almacenamiento de
imágenes" instead of an upload button — the rest of the panel, and the public
site, are unaffected. The app boots and serves normally either way. Create the
bucket and an API token in the Cloudflare dashboard, set the five vars in the
Hostinger app env panel, and redeploy to activate uploads.

Deleting a gallery row does not delete the R2 object — storage is cheap and an
orphaned object is recoverable, a deleted one is not.

---

## Environment variables

See `.env.example`. The **minimum-to-launch** subset (site runs on seed data):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (sitemaps, JSON-LD) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Platform WhatsApp (header/contact), E.164 digits |
| `NEXT_PUBLIC_REVIEWS_ENABLED` | `false` — ratings/reviews UI gate (honesty); needs `DATABASE_URL` too, see **Reviews** |
| `NEXT_PUBLIC_PROMO_BANNER` | `off` — launch promo banner toggle |

`DATABASE_URL` (MySQL) selects the DB provider (see **Database** above) and is
required for running the migrations and the seed importer locally. Unset in
local dev, the app renders from the seed dataset instead.

`SESSION_SECRET` (≥32 chars, `openssl rand -base64 32`) seals the admin session
cookie. The app **throws at boot** if it is missing or short rather than falling
back to a default, because a default secret is a forgeable session. Changing it
signs everyone out — which is also how you revoke every session at once.

Add when ready: `GHL_WEBHOOK_URL`, `SHEETS_WEBHOOK_URL`, `LEADS_WEBHOOK_TOKEN`
(lead routing); `NEXT_PUBLIC_MAP_TILES` (map style); `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
(cookieless visitor analytics — create a free/self-hosted Plausible site for your
domain, set this to the domain, redeploy; no cookie banner needed either way).

---

## Seeding / editing data

The fallback dataset is **`lib/providers/seed-data.ts`** (~24 real Paraguayan
businesses across all rubros, premium + free mix). To add or edit a business,
edit that array — derived fields (labels, initial, coordinates) are filled
automatically. Photos are **first-party SVGs in `public/seed/`**; never hotlink
external images.

Categories live in `lib/categories.ts` (slug is a public URL — keep it stable);
cities and coordinates in `lib/cities.ts`.

`scripts/import-seed.ts` loads all of that into MySQL (see **Database** above).
It is keyed on `slug` and runs in one transaction, so re-running it updates
instead of duplicating and a failure rolls the whole import back.

---

## Lead orchestrator — how to wire GHL / Sheets

All contact paths converge on **`lib/leads.ts`** + `POST /api/v1/leads`:

- listing message, listing WhatsApp (tracked via `sendBeacon`), `/sumar-negocio`
  (business acquisition), `/contacto`.
- Payloads are **zod-validated** (discriminated union on `source`) and flattened
  to `snake_case`.
- Fan-out is **parallel** (`Promise.allSettled`) to the GoHighLevel and Google
  Sheets webhooks, each with **3× exponential-backoff retries**.
- Every lead is **persisted to the `leads` table first**, before the webhook
  fan-out (`lib/db/leads.ts`), so it survives a dead webhook. A DB write
  failure is caught and logged, never surfaced to the visitor.
- A sink or DB failure **never** fails the visitor's request. Until the webhook
  envs are set, leads are logged to the server console and still succeed.

To activate routing, set `GHL_WEBHOOK_URL` and/or `SHEETS_WEBHOOK_URL` (and
optionally `LEADS_WEBHOOK_TOKEN`), then redeploy — one at a time.

**VenderCRM (ROADMAP F6).** Set `VENDERCRM_URL` and `VENDERCRM_API_KEY` (both
required together) to also fan out to `POST {VENDERCRM_URL}/api/v1/leads` with
an `X-Api-Key` header, using the same retry shape as GHL/Sheets and a stable,
hash-derived `idempotency_key` so a retried POST replays instead of creating a
duplicate contact. This only applies to `sumate`, `contacto` and
`listing_whatsapp` — the three sources the ROADMAP item names — and only when
VenderCRM's required `phone` field is actually available. `sumate` has one;
`contacto` and `listing_whatsapp` don't collect any contact info today, so
rather than invent a phone number to satisfy the requirement, the VenderCRM
POST is skipped for those leads and logged (`[leads] skipping VenderCRM for
"..." lead: no phone field collected`) — it is never counted as a failed sink.

---

## SEO & honesty

- JSON-LD: `LocalBusiness` on detail pages, `ItemList` on category/landing,
  `BreadcrumbList` on both, `WebSite` + SearchAction on the home page.
- Programmatic `/[categoria]/[ciudad]` pages are generated **only for combos with
  real listings**; empty combos `404` (never an empty shell).
- `sitemap.xml` / `robots.txt` are generated from the repo with hourly ISR.
- **No fabricated ratings or reviews.** The entire reviews UI is gated behind
  `NEXT_PUBLIC_REVIEWS_ENABLED` (default `false`) and only renders when real data
  exists. See **Reviews** below for what the flag now switches on.

---

## Reviews (first-party)

Visitors leave reviews on a listing page; staff moderate them at
`/admin/resenas`. Nothing a stranger writes is public until a human approves it.

Both switches are required, and `false`/unset is the safe state:

- `NEXT_PUBLIC_REVIEWS_ENABLED=true` — the honesty gate the ratings UI has
  always been behind.
- `DATABASE_URL` — a submission has nowhere to land without one, so the
  section and `POST /api/v1/reviews` stay off (the endpoint 404s) on the seed
  dataset. Local dev and the Playwright smoke run therefore have no reviews.

**The `reviews` table OWNS `listings.rating` and `listings.reviews_count.`**
They are recomputed from the listing's *approved* reviews inside the same
transaction as every approve/reject (`lib/db/reviews-admin.ts`), never typed
in: no `fields.ts` exposes them, and `scripts/import-seed.ts` deliberately does
not write them either — as an idempotent re-runnable importer it would have
reset a real, earned average to NULL. With no approved reviews both columns go
back to NULL, never `0`.

Two write paths, two different guards:

| Path | Module | Guard, as the first statement |
| --- | --- | --- |
| Public submission | `lib/db/reviews.ts` | `requirePublicWrite` — honeypot, then a per-IP rate limit (5/hour) |
| Moderation | `lib/db/reviews-admin.ts` | `requireRole(['admin', 'editor'])` |

`requirePublicWrite` (`lib/public-write.ts`) is the public-form equivalent of
`requireRole` and exists for the same reason: a form has no session to check,
but its query-module function is still directly reachable, so the spam
defenses belong *in the query module*, not in the route. `/api/v1/reviews` only
maps the thrown reasons onto status codes — and a honeypot hit is answered with
the same success the visitor sees, exactly like `/api/v1/leads`.

Moderation is `editor`-capable, unlike `/admin/leads` (`admin`-only). The line
those two guards draw is "public-facing content" vs "a member of the public's
contact details": a review row holds a display name, a rating and a body and
**no way to contact the author**, and editing what visitors read on a listing
page is already the editor role's job.

Rejecting is a status change, never a delete — a rejected review is the
evidence for why it was rejected. Every decision is written to `activity_log`
in the same transaction, which is why the table has no `moderated_by` /
`moderated_at` columns of its own.

---

## Design tokens

The single source of truth is **`app/globals.css` `:root`** (mirrored in
`tailwind.config.ts`). Colours are exposed both as CSS variables and Tailwind
utilities; no page hardcodes a colour. The approved visual reference is
`design/reference.html`. Fonts: **Newsreader** (business names + section
headings) and **Hanken Grotesk** (UI/body), loaded via `next/font`.

Colour rules: blue only for actions/links; terra/terragold for warm accents,
“Destacado” and “Abierto ahora”; green only for WhatsApp. No blue background
slabs, no diagonal ribbons. Missing photos always render the warm gradient
fallback (initial + category icon), never an empty grey box.

---

## Deployment — Hostinger Node.js Web App

Standard Next.js server (`next build` / `next start`). **Never** use
`output: 'export'`. CI runs `npm ci`, `npm run typecheck`, `npm run test` and
`npm run build` on every push and PR, plus a `production-build` job (no
devDependencies) and an `e2e` job (Playwright smoke tests) — see **Testing**
below.

1. hPanel → **Websites** → **Add Website** → **Node.js Apps**
2. **Import Git Repository** → branch `main`
3. Framework preset: **Next.js**, root `./`, Node **LTS (22.x)**
4. Set environment variables (start with the minimum block)
5. **Deploy**, then attach the domain.

Merge to `main` = redeploy. Adding an integration = add its env vars + redeploy.
**Database migrations are not part of the deploy** — apply them from a local
machine before merging the PR that needs them (see **Database** above).

### Build memory cap (ROADMAP F8)

Hostinger's Node.js app hosting runs the build on a single worker with no
heap cap by default — on a memory-constrained plan a large `next build` can
OOM. **USER:** in hPanel → the app → **Environment variables**, set
`NODE_OPTIONS=--max-old-space-size=1536` (adjust the number down if the plan's
RAM is smaller; 1536 MB is a reasonable default for Hostinger's common
Node.js tiers), then redeploy. This is a panel setting only — there is
nothing in the repo to change for it.

### The production build has no devDependencies

Hostinger sets `NODE_ENV=production` as an app environment variable, so its
`npm install` **omits `devDependencies`** — `drizzle-kit`, `vitest`, `tsx` and
`eslint` do not exist on the build machine.

`next build` type-checks every file `tsconfig.json` includes. A tooling file
that imports a devDependency therefore fails the **production** build while
passing locally and in CI, where those packages are installed. That is exactly
how `drizzle.config.ts` (added in PR-1) broke every deploy from PR-1 onward
while CI stayed green.

The arrangement that prevents it:

- **`tsconfig.json`** — what `next build` checks. Excludes `tests/`, `e2e/`,
  `drizzle.config.ts`, `vitest.config.ts` and `playwright.config.ts`: tooling,
  unreachable from the app.
- **`tsconfig.typecheck.json`** — what `npm run typecheck` and CI check.
  Includes everything, so those files stay strictly typed.
- **CI's `production-build` job** — installs with `npm ci --omit=dev` under
  `NODE_ENV=production`, reproducing the Hostinger install. This is the only
  job that can catch a production-only build failure.

Do **not** remove `NODE_ENV=production` from the Hostinger panel to work around
this. `server.js` boots Next programmatically rather than via `next start`, so
nothing else sets it — and `lib/auth/session.ts` reads it to decide whether the
session cookie carries the `secure` flag. Unsetting it would ship the admin
session cookie over plain HTTP.

---

## Mail and the expiry digest

`lib/mail.ts` is an env-gated SMTP transport (nodemailer), the same pattern as
Sentry and R2: with `SMTP_*` unset nothing is constructed, and the app boots
and serves normally. All five variables are required together — a
half-configured transport does not fail loudly, it hangs on connect.
`mailConfigured()` is what everything checks.

**This module is the PR-6 blocker-killer.** "Password reset by email" is the
gate on ever announcing the owner portal to a real business, and it needs
exactly this transport and nothing else.

There is deliberately **no queue and no retry loop**. The only sender today is
a weekly staff digest triggered by an external cron: if it fails, the cron
retries next week and nobody is blocked. Durable delivery is the hard part and
gets built when there is a message a human is waiting on.

### The digest

`POST /api/internal/expiry-digest` mails staff every business whose Premium or
"destacado en portada" slot ends within 14 days (ROADMAP D6). Hostinger's Node
app has no cron, so an external scheduler (cron-job.org, UptimeRobot) calls it
once a week.

That makes `EXPIRY_DIGEST_TOKEN` the only thing between the public internet and
a mail send:

- compared with `timingSafeEqual`, not `===`, so the token's prefix cannot be
  recovered by timing;
- **unset means the endpoint 404s** — "forgot to set it" must never mean "open
  to everyone";
- 404, never 401, for the same reason `/admin` does;
- `POST`, not `GET`: a crawler, a link preview or a browser prefetch issues
  GETs, and every one of them would send mail.

It reads and mails and writes nothing, so running it twice sends two identical
emails and changes no state — the right failure mode for something a
third-party scheduler retries on a timeout. With nothing expiring it sends
nothing at all; a weekly "nothing to do" is how a digest becomes a folder
nobody opens.

The wording and the urgency live in `lib/admin/digest.ts`, which is **pure** —
listings in, subject and text out — so it is tested without SMTP, a database or
a clock, exactly like `lib/admin/validation.ts`.

---

## Monitoring

**Error tracking (Sentry).** `instrumentation.ts` initialises the server and
edge SDKs (`sentry.server.config.ts` / `sentry.edge.config.ts`) when
`SENTRY_DSN` is set; unset, `Sentry.init` runs with `enabled: false` — no
network calls, no effect on boot. **Deliberately server/edge only, no browser
SDK**: a client-side `Sentry.init` added roughly 67 kB to this app's shared JS
bundle (87.8 kB → 155 kB), which is a bad trade for a mostly server-rendered
directory site where the failures worth paging on are 500s and admin-action
errors, not client render errors. Revisit if that stops being true.

Create a free project at sentry.io, set `SENTRY_DSN` in the Hostinger env
panel, redeploy. Source maps for readable stack traces are optional and need
three more vars (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`); unset,
`next.config.mjs`'s `withSentryConfig` just skips the upload.

**Uptime (UptimeRobot).** `GET /api/health` returns `{ok: true}` and
deliberately does **not** touch the database — it proves the Next.js server
itself is up, which is what "is the site down" means for a visitor, since most
pages keep serving through `lib/listings-repo.ts` even through a brief MySQL
blip. Point a free UptimeRobot HTTP monitor at
`https://negocio.com.py/api/health`.

## Testing

`npm test` (vitest) is pure — no MySQL, no browser, safe to run anywhere.

`npm run lint` (ESLint, flat config in `eslint.config.mjs`) is also pure. The
dependency and the script existed long before anything ran them — Next 16
decoupled linting from `next build` and there was no config file for the CLI to
find. Two overrides are deliberate and documented in the config: `require()` is
allowed in `server.js` (the Passenger entry point is CommonJS), and
`react-hooks/purity` is off for `app/admin/**/page.tsx` (those are server
components with `force-dynamic`; reading the clock is how "is premium still
active right now" is answered).

`npm run test:e2e` (Playwright) runs the smoke suite in `e2e/` against a
production build on the **built-in seed data** — no `DATABASE_URL` needed. It
starts its own server (`npm run build && npm run start`) unless
`PLAYWRIGHT_BASE_URL` is set. First run: `npx playwright install --with-deps
chromium`. This is a smoke suite, not a regression suite — the golden path a
visitor takes (home → listing → search → category), plus `/admin` 404-ing with
no database and an unknown route 404-ing.

### The admin round-trip (MySQL) — `npm run test:e2e:admin`

`npm run test:e2e:admin` (ROADMAP W1-6) is the only suite that needs a
database. It signs in as a bootstrapped administrator, walks the forced
password change, creates a listing, checks it on the public site, edits it,
submits a review through the real public endpoint, approves it in the
moderation queue, and deletes the listing with the typed-slug confirmation —
all real writes against real MySQL.

It covers what the DB-free smoke suite structurally cannot: without
`DATABASE_URL` the panel 404s, so login, the guards, the CRUD slices and the
moderation queue were never exercised end to end by anything. It earned its
keep before it was merged, by catching a cache-invalidation bug in W1-3 that
left edited listings stale on the public site indefinitely.

It needs a **fresh** database — `bootstrap-admin` refuses to run twice, and the
first test changes that account's password:

```sh
export DATABASE_URL="mysql://user:pass@host:3306/negocio_e2e"
export SESSION_SECRET="$(openssl rand -base64 32)"
export NEXT_PUBLIC_REVIEWS_ENABLED=true   # read at BUILD time, so set it first
npm run db:migrate && npm run db:import-seed
npm run bootstrap-admin -- --email e2e@negocio.com.py --name "E2E Admin"
export E2E_ADMIN_EMAIL=e2e@negocio.com.py
export E2E_ADMIN_PASSWORD="<the password it printed>"
npm run test:e2e:admin
```

In CI it is `.github/workflows/admin-e2e.yml`, **manually triggered only**
(Actions tab → "Admin e2e (MySQL)"). It brings up a MySQL service container and
does all of the above itself. Run it before merging anything that touches
`/admin`, `lib/db/*` or `lib/auth/*`, and after any autonomous batch of admin
work. It is not on every PR because a service container plus migrations plus a
seed import plus a production build plus a browser costs more minutes than the
rest of this repo combined, and almost no PR touches the admin.

### CI is one job, on pull requests only

`.github/workflows/ci.yml` runs typecheck → lint → test → build → e2e →
production install/build as a **single** job, triggered by `pull_request` and
`workflow_dispatch`. That shape is a budget decision, not a style one: Actions
minutes bill per account and **every job rounds up to a whole minute**, so four
90-second jobs cost four minutes and one five-minute job costs five while doing
strictly more. The trigger is PR-only (a `push: [main]` trigger re-ran the same
suite on the merge commit), `concurrency` cancels superseded runs when several
commits land in a row, `paths-ignore` skips doc-only changes, and
`timeout-minutes` overrides GitHub's 360-minute default.

`.github/dependabot.yml` is monthly and grouped for the same reason. GitHub's
security alerts are separate from that file and are *not* throttled by it — a
real CVE still opens its own PR immediately.

### The rate limiter is single-process

`lib/rate-limit.ts` keeps its buckets in a `Map` in the Node process's heap.
That is correct today because Hostinger runs exactly one process per app, and
it is written up here because the failure mode is silent: a restart resets
every bucket, and running behind *N* processes multiplies every configured
limit by *N* without anything erroring. The replacement, when the process count
actually changes, is a shared store (Redis/Upstash) behind the same two
functions — no caller changes. Not before then: a network round-trip on every
public form submission is the worse trade while there is one process.
