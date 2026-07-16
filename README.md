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
```

---

## Project layout

```
app/                       Routes (App Router)
  page.tsx                 Home
  buscar/                  Search results (filters, list/map)
  [categoria]/             Category landing (all cities)
  [categoria]/[ciudad]/    Programmatic SEO landing
  lugar/[slug]/            Business detail (Free & Premium = one template)
  precios, sumar-negocio, contacto, nosotros
  api/v1/listings          GET list (zod-validated)
  api/v1/listings/[slug]   GET one
  api/v1/leads             POST single lead orchestrator
  sitemap.ts, robots.ts    Generated from the listings repo
components/                UI (cards, pills, maps, forms, detail blocks)
lib/                       Domain logic
  listings-repo.ts         THE single data-access surface (the seam)
  providers/               seed.ts · jetengine.ts · query.ts (shared filtering)
  types.ts, config.ts, categories.ts, cities.ts, hours.ts, format.ts
  leads.ts                 Lead orchestrator (zod + fan-out)
  jsonld.tsx               schema.org builders
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

- `NEXT_PUBLIC_BACKEND=jetengine` **and** WP creds present → **JetEngine**, with
  the **seed as an automatic fallback** on any error.
- otherwise → **seed** (the permanent fallback).

### Swapping JetEngine → Supabase later

1. Add `lib/providers/supabase.ts` implementing `ListingsProvider`.
2. Change the **one** `selectPrimary()` line in `listings-repo.ts`.
   Nothing else in the app changes.

---

## JetEngine field mapping — how to correct the keys

The WordPress/JetEngine provider lives in `lib/providers/jetengine.ts`. It reads
the `negocios` custom post type over the WP REST API using a **WordPress
Application Password (Basic Auth), server-side only** — credentials never reach
the client.

The meta field keys are **UNVERIFIED guesses** until checked against the live
setup. They are isolated in **one block** marked:

```
// ============================ JETENGINE FIELD MAP ============================
```

Each line carries a `// TODO: verify field key against live JetEngine`. After
the post type is configured:

1. Open `lib/providers/jetengine.ts`, find that block.
2. Replace the meta key strings (e.g. `meta['telefono']`) with the real keys.
3. Confirm the taxonomy slugs `categoria` and `ciudad`, the featured-image
   mapping, and the `premium_until` / `verificado` keys.

A missing field maps to `undefined` and **never** hard-fails; a down panel
degrades to the seed. See also `FIELD-MAP.md`.

---

## Environment variables

See `.env.example`. The **minimum-to-launch** subset (site runs on seed data):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (sitemaps, JSON-LD) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Platform WhatsApp (header/contact), E.164 digits |
| `NEXT_PUBLIC_BACKEND` | `seed` (default) or `jetengine` |
| `NEXT_PUBLIC_REVIEWS_ENABLED` | `false` — ratings/reviews UI gate (honesty) |
| `NEXT_PUBLIC_PROMO_BANNER` | `off` — launch promo banner toggle |

Add when ready: `NEXT_PUBLIC_PANEL_URL`, `WP_APP_USER`, `WP_APP_PASSWORD`
(backend); `GHL_WEBHOOK_URL`, `SHEETS_WEBHOOK_URL`, `LEADS_WEBHOOK_TOKEN`
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

---

## Lead orchestrator — how to wire GHL / Sheets

All contact paths converge on **`lib/leads.ts`** + `POST /api/v1/leads`:

- listing message, listing WhatsApp (tracked via `sendBeacon`), `/sumar-negocio`
  (business acquisition), `/contacto`.
- Payloads are **zod-validated** (discriminated union on `source`) and flattened
  to `snake_case`.
- Fan-out is **parallel** (`Promise.allSettled`) to the GoHighLevel and Google
  Sheets webhooks, each with **3× exponential-backoff retries**.
- A sink failure **never** fails the visitor's request. Until the webhook envs
  are set, leads are logged to the server console and still succeed.

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
`output: 'export'`. CI is a single step: `npm ci && npm run build`.

1. hPanel → **Websites** → **Add Website** → **Node.js Apps**
2. **Import Git Repository** → branch `main`
3. Framework preset: **Next.js**, root `./`, Node **LTS (22.x)**
4. Set environment variables (start with the minimum block)
5. **Deploy**, then attach the domain.

Merge to `main` = redeploy. Adding an integration = add its env vars + redeploy.
