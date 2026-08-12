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
app/                       Routes (App Router)
  layout.tsx               <html>, fonts, analytics — nothing route-specific
  (public)/                The consumer site; the group is NOT part of any URL
    layout.tsx             Header / footer / bottom nav / promo banner
    page.tsx               Home
    buscar/                Search results (filters, list/map)
    [categoria]/           Category landing (all cities)
    [categoria]/[ciudad]/  Programmatic SEO landing
    lugar/[slug]/          Business detail (Free & Premium = one template)
    precios, sumar-negocio, contacto, nosotros
  (auth)/                  ingresar · cambiar-contrasena (bare chrome)
  admin/                   First-party staff panel (see "Admin & auth")
  api/v1/listings          GET list (zod-validated)
  api/v1/listings/[slug]   GET one
  api/v1/leads             POST single lead orchestrator
  sitemap.ts, robots.ts    Generated from the listings repo
components/                UI (cards, pills, maps, forms, detail blocks)
  admin/                   AdminTable · AdminForm · AdminNav (the whole panel UI)
lib/                       Domain logic
  listings-repo.ts         THE single data-access surface (the seam)
  providers/               seed.ts · db.ts · query.ts (shared filtering)
  db/                      schema.ts · client.ts · mappers.ts · listing-query.ts ·
                           leads.ts · users.ts · activity-log.ts
  auth/                    session.ts · roles.ts · password.ts · login.ts
  admin/                   validation.ts (pure) · labels.ts
  types.ts, config.ts, categories.ts, cities.ts, hours.ts, format.ts
  leads.ts                 Lead orchestrator (zod + fan-out)
  jsonld.tsx               schema.org builders
drizzle/                   Generated SQL migrations (applied from a local machine)
scripts/import-seed.ts     Idempotent seed → MySQL import (tsx)
scripts/bootstrap-admin.ts Creates the first administrator, once (tsx)
tests/                     vitest — pure, no database
design/reference.html      Approved visual reference (the design source)
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

## Database (MySQL + Drizzle)

Schema: `lib/db/schema.ts`, derived from `lib/types.ts` — never from a CMS's
field names. Eight tables: `listings`, `listing_hours`, `listing_gallery`,
`categories`, `cities`, `leads`, `users`, `activity_log`.

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
- **The session cookie carries only** id, role, scope id and
  `mustChangePassword`; 8-hour TTL, `httpOnly`, `sameSite: lax`, `secure` in
  production. Everything else is read from the database at use time, so
  suspending an account takes effect on the next request.
- **No default password anywhere.** Admin-issued resets generate a random one
  and return it as a one-time on-screen notice — deliberately not a redirect
  carrying it in a query string, which would land in access logs and history.
- **Roles are a satisfaction map, not a numeric ladder.** `admin` satisfies
  `admin` + `editor`. The `owner_*` values exist in the enum (reserved for the
  owner portal) but satisfy nothing staff-facing and cannot be assigned from any
  form — with a numeric ladder, `owner_admin >= editor` would hand an owner a
  staff screen.
- **Password reset by email is deliberately deferred.** It needs another table
  and a mail integration. That is acceptable only while nobody outside the team
  has an account — a self-serve owner portal must not be announced to real
  businesses until it exists, or a locked-out owner is recoverable only by an
  admin.

### What is not built yet

The hours editor, gallery upload, `premiumUntil` and the `verified` flag. See
ROADMAP Phase B, PR-5. Listing / category / city CRUD (`/admin/negocios`,
`/admin/rubros`, `/admin/ciudades`) and a read-only `/admin/leads` list
(`admin`-only) shipped in PR-4.

---

## Environment variables

See `.env.example`. The **minimum-to-launch** subset (site runs on seed data):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (sitemaps, JSON-LD) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Platform WhatsApp (header/contact), E.164 digits |
| `NEXT_PUBLIC_REVIEWS_ENABLED` | `false` — ratings/reviews UI gate (honesty) |
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

---

## SEO & honesty

- JSON-LD: `LocalBusiness` on detail pages, `ItemList` on category/landing,
  `BreadcrumbList` on both, `WebSite` + SearchAction on the home page.
- Programmatic `/[categoria]/[ciudad]` pages are generated **only for combos with
  real listings**; empty combos `404` (never an empty shell).
- `sitemap.xml` / `robots.txt` are generated from the repo with hourly ISR.
- **No fabricated ratings or reviews.** The entire reviews UI is gated behind
  `NEXT_PUBLIC_REVIEWS_ENABLED` (default `false`) and only renders when real data
  exists. Reviews are a future first-party (Phase-2) feature.

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
`npm run build` on every push and PR.

1. hPanel → **Websites** → **Add Website** → **Node.js Apps**
2. **Import Git Repository** → branch `main`
3. Framework preset: **Next.js**, root `./`, Node **LTS (22.x)**
4. Set environment variables (start with the minimum block)
5. **Deploy**, then attach the domain.

Merge to `main` = redeploy. Adding an integration = add its env vars + redeploy.
**Database migrations are not part of the deploy** — apply them from a local
machine before merging the PR that needs them (see **Database** above).

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

- **`tsconfig.json`** — what `next build` checks. Excludes `tests/`,
  `drizzle.config.ts` and `vitest.config.ts`: tooling, unreachable from the app.
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
