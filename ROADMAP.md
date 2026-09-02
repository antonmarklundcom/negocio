# ROADMAP — negocio.com.py

> **This is the working plan.** New Claude Code sessions: read this file first,
> branch off fresh `main`, and update the checkboxes in the same PR as the work.
> Architecture context lives in `README.md`.

## Status

Phase 1 (the full Next.js app) is **done and on `main`**: SSR pages, seed data,
lead orchestrator, maps, SEO, Hostinger entry (`server.js`).

**Backend decision (superseding the old Phase B):** WordPress/JetEngine is
cancelled. The backend becomes our own MySQL database plus a first-party admin
inside this Next.js app. See "Phase B — Native backend" below.

**2026-08-19 — full repo analysis + agreed forward plan.** Phases B and C are
complete; Phase D items 1–6 are shipped. A three-agent code review (public UX,
roles/security, tech/build) produced a set of findings and decisions, all
confirmed by the user. The forward plan now lives in **"Phase E — Agreed build
waves"** below: read the Decisions log first, then build the waves in order.
Phase D items 7–8 are folded into Wave 3.

---

## Phase A — Launch *(in progress)*

- [x] Next.js app, seed data, all routes (PR #1)
- [x] Hostinger deploy fixes: build deps + `server.js` (PR #2)
- [x] Extra seed listings (PR #3)
- [x] Favicon + Open Graph image
- [x] GitHub Actions CI: `npm ci && npm run build` on every push/PR
- [x] Lead spam protection: per-IP rate limit + honeypot on all forms
- [x] `sharp` for production image optimization
- [x] Fix: `salud` category renders its `servicios` list
- [x] Add analytics (Plausible, cookieless, off until `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set)
- [ ] **USER:** Hostinger panel — Build command `npm run build`, Entry file
      `server.js`, Node 22, env vars from `.env.example` minimum block; deploy `main`
- [ ] **USER:** point domain + SSL at the deployment
- [ ] Post-deploy smoke test on the real domain (`/`, a listing, `/buscar`, sitemap)
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] **USER:** create a Plausible site for the domain, set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, redeploy

---

## Phase B — Native backend: own MySQL + first-party admin

Replaces the cancelled WordPress/JetEngine plan. Reference implementation:
**educacion.com.py** (PRs #18–#24). Copy its shapes; do not re-derive them.
The governing playbook is the `wp-to-native-admin` skill.

### Findings that shape this phase

- **JetEngine was never live.** `NEXT_PUBLIC_BACKEND=seed` everywhere, no WP
  credentials, every meta key in the old field map unverified, and
  `parseHours()` never parsed a real payload. **There is no migration and no
  parity check** — we go seed → MySQL and delete the WP provider outright.
- **The seam already exists.** `lib/listings-repo.ts` is the single data-access
  surface; every page and API route reads through it. The backend swap is one
  new provider plus one line in `selectPrimary()`. No PR-0 needed.
- **Stack delta:** this repo is Next 14 with no DB, no auth, no ORM, no tests.
  Drizzle + `mysql2` + vitest arrive in PR-1. **Do not upgrade Next in the same
  PR as any of this** — the Next 15/16 upgrade stays in Phase C, on its own.

### Entity list

| Table | Edited by | Notes |
|---|---|---|
| `listings` | staff | The main entity. Columns derived from `Listing` in `lib/types.ts`. |
| `listing_hours` | staff | Child table — drives "Abierto ahora", so it is queried, not just rendered. |
| `listing_gallery` | staff | Child table — ordered, premium-gated. |
| `categories` | staff | Seeded from `lib/categories.ts`; `blockKind` is a fixed enum. |
| `cities` | staff | Seeded from `lib/cities.ts`. |
| `users` | admin only | Staff now; business owners in PR-6. |
| `activity_log` | written by mutations only | Never edited through the UI. |
| `leads` | read-only in admin | Persisting leads (Phase D item 1's prerequisite). |

Category-block fields (`especialidades`, `productos`, `servicios`,
`destacadoItem`) are **JSON columns**, not child tables: they are render-only
and never filtered on. `hours` and `gallery` are child tables because they are.
This split is decided in PR-1 and cannot be changed later without a migration
applied by hand.

### Roles

Explicit "what each role satisfies" map — **not a numeric ladder**.

- `admin` — everything, including user management.
- `editor` — listing/category/city CRUD, no user management, cannot set `verified`.
- `owner_admin` / `owner_editor` — **PR-6 only.** Zero standing outside their
  own listing. The values exist in the `users.role` enum as of PR-3 (so PR-6
  needs no enum migration) but satisfy nothing staff-facing and are rejected by
  both the form and the query module.

`editor` cannot set `verified` or `premiumUntil` — those fields do not exist in
any `fields.ts` at all, which is the enforcement (PR-5 adds them behind `admin`).

### The PR sequence — one PR each, in order, nothing parallel

- [x] **PR-1 — Schema + DB provider.** Drizzle + `mysql2` + vitest. Tables from
      `lib/types.ts`, never from JetEngine's meta keys. `lib/providers/db.ts`
      implements `ListingsProvider`. Seed data becomes an idempotent `tsx`
      import script keyed on `slug`. Migrations are generated in the repo and
      **applied from a local machine** — every later PR is planned around that,
      or code lands needing a column nobody applied and 500s in production.
      *Shipped: `lib/db/{schema,client,connection,mappers,listing-query,open-now,query-helpers}.ts`,
      `lib/providers/db.ts`, `scripts/import-seed.ts`, `drizzle/0000_*.sql`,
      61 vitest tests wired into CI. The provider is **not selected** — the site
      still renders from seed until PR-2. The migration and the seed import are
      run by hand from a local machine (README → Database).*
- [x] **PR-2 — Cutover + cleanup.** Flip `selectPrimary()` to the DB provider;
      delete `lib/providers/jetengine.ts`, `FIELD-MAP.md`, the WP env vars, and
      `withFallback`. *(Moved ahead of the admin: with no WP data there is
      nothing to watch for a day, and leaving `withFallback` alive through the
      admin PRs means a DB error silently serves stale seed data and looks
      fine.)*
      *Shipped: `selectPrimary()` in `lib/listings-repo.ts` now returns
      `dbProvider` when `dbConfigured()` (i.e. `DATABASE_URL` is set), else
      `seedProvider` — `withFallback` is gone, so a DB error surfaces instead
      of silently serving stale seed data. Deleted `lib/providers/jetengine.ts`,
      `FIELD-MAP.md`, the WP env vars, and `NEXT_PUBLIC_BACKEND`. `lib/leads.ts`
      now persists every lead to the `leads` table (`lib/db/leads.ts`) before
      the webhook fan-out; a DB write failure is caught and logged, never fails
      the visitor's request.
- [x] **PR-3 — Auth foundation.** `iron-session`, `node:crypto` scrypt, `users`
      table, `requireRole()`, login/logout, forced password change,
      `scripts/bootstrap-admin.ts`.
      *Shipped: `lib/auth/{session,roles,password,login}.ts`,
      `lib/db/{users,activity-log}.ts`, `lib/admin/{validation,labels}.ts`,
      `components/admin/{AdminTable,AdminForm,AdminNav}.tsx`, `/ingresar`,
      `/cambiar-contrasena`, `/admin` + `/admin/usuarios` CRUD,
      `drizzle/0001_*.sql` (`users`, `activity_log`), 89 new vitest tests.
      Four scope decisions taken here, recorded in README → Admin & auth:*
      - ***No `scopeToOwner()`.*** Staff-only login; there is nothing to scope
        against until `listings` gains an owner column, which is PR-6's
        migration. Shipping unused scope functions would be dead code no test
        could meaningfully guard. The `role` enum does carry all four values
        already, so PR-6 needs no enum ALTER.
      - ***Users CRUD landed here, not in PR-4.*** `bootstrap-admin` refuses to
        run twice, so without it there is no way to create an editor except by
        hand-written SQL — and account creation would live outside the activity
        log. This pulls `AdminTable`/`AdminForm` forward, which is what makes
        PR-4 "a field list and a column list per entity".
      - ***`activity_log.entity_id` is VARCHAR(64), not INT*** — a deliberate
        deviation from the reference build. `listings.id` is a varchar and
        `categories`/`cities` are keyed on their slug, so an int column could not
        log the site's three main entities.
      - ***`app/(public)/` route group.*** The root layout kept the consumer
        header, footer, bottom nav and promo banner, which `/admin` would have
        inherited. Chrome moved into the group; URLs are unchanged.
- [ ] **USER (PR-3, in this order — the panel 404s until all three are done):**
      1. `npm run db:migrate` from a local machine — applies `drizzle/0001_*`.
         Do this **before** the deploy or `/admin` 500s.
      2. `openssl rand -base64 32` → `SESSION_SECRET` in the Hostinger app env
         panel, then redeploy. The app throws at boot without it, by design.
      3. `npm run bootstrap-admin -- --email … --name "…"` — copy the printed
         password once, sign in at `/ingresar`, change it immediately.
- [x] **PR-4 — Core CRUD.** Listings, categories, cities, plus a read-only leads
      list. The shell, `AdminTable`, `AdminForm`, the pure validation module and
      `activity_log` all landed in PR-3 — this PR is a `fields.ts` + column list
      + query module per entity, copying the `usuarios` slice exactly.
      *Shipped: `lib/db/{listings-admin,taxonomy-admin,leads-admin}.ts`,
      `lib/admin/blocks.ts` (pure parse/serialise for the JSON block fields),
      four new `fields.ts`/`actions.ts` slices under `app/admin/{negocios,rubros,
      ciudades,leads}`, 96 new vitest tests. `/admin/leads` is `admin`-only
      (open question 1: a lead carries a member of the public's contact
      details). Deleting a category or city with listings attached is refused
      with the count, never a 500 (open question 2). No migration — every
      column this PR touches shipped in PR-1. Canary run: `requireRole` deleted
      from every function in both new query modules, all 50 access tests in
      `tests/listings-admin-access.test.ts` and `tests/taxonomy-admin-access.test.ts`
      went red, guard restored.*
- [x] **PR-5 — The awkward fields.** Hours editor, gallery/photo upload to
      object storage, `premiumUntil`, the `verified` flag, staleness/expiry
      dashboard.
      *Shipped: `setListingHours` (delete-then-insert, reusing
      `rowsToDayHours`/`dayHoursToRows`/`toMinutes`/`toHHMM` from PR-1 — no
      second time parser), `lib/admin/validation.ts`'s `parseHoursInput`
      (siesta gaps, midnight crossers, a `00:00` close, overlap/duplicate
      detection) and `parsePremiumUntilDate`/`formatPremiumUntilDate`
      (`YYYY-MM-DD` ⇄ unix seconds at 23:59:59 America/Asuncion). Gallery:
      `lib/media/upload.ts` (magic-byte sniffed, EXIF-stripped via
      `sharp().rotate()`, re-encoded to WebP, `aws4fetch` SigV4 PUT to R2) and
      `lib/media/url.ts`'s `mediaUrl()`, routed through every render site
      (`lugar/[slug]`, `ListingCard`, `jsonld.tsx`, `CategoryBlock`).
      `setListingFlags` (`verified`/`premiumUntil`) is a separate
      `admin`-only function from `updateListing`, not a widened one — the
      editor write path is physically unable to set them. Staleness dashboard
      on `/admin` links into `/admin/negocios?estado=…`.
      **R2_* unset** (the bucket does not exist yet — open question 1): the
      gallery section shows "Falta configurar el almacenamiento de imágenes"
      instead of an upload button; the app boots and serves normally either
      way (verified: production build + `node server.js` with no DB/R2 env,
      `/` 200, `/admin` 404, no server errors). The redeploy test (upload →
      redeploy → confirm the photo still renders) is **UNTESTED PENDING
      CREDENTIALS** — no R2 account exists to test against; do not read this
      as passing. "Stale" = 180 days since `updated_at` (open question 2).
      No migration — every column shipped in PR-1. Canary run: `requireRole`
      deleted from every function in `lib/db/listings-admin.ts` (14 guards),
      all 26 affected tests in `tests/listings-admin-access.test.ts` went red,
      guard restored.*
- [ ] **PR-6 — Self-serve business dashboard.** *(LATER — only at ≥20 paying
      businesses.)* Do not build before then, and **do not announce it to real
      businesses until password reset by email exists.** On educacion the portal
      was built and had to be held back for exactly this: a locked-out owner
      would only be recoverable by an admin.

### Rules that do not bend

Each of these caught a real bug on educacion.

1. Every mutation calls `requireRole()` as its **first statement, inside the
   query module** — not in the server action. A server action is directly
   reachable and Next does not re-run the `/admin` layout for it. The layout
   guard is a backstop.
2. Hidden buttons are UX, not access control.
3. Owner-scoped reads filter on the **session's** id, never an id from the
   request. The scope function **throws** on mismatch; it does not quietly
   substitute the session's own id.
4. Every id in a URL path is an object reference: check it against the session
   **before** validating the form, not after.
5. Row-not-found and row-not-yours return the **same** error. Different answers
   turn the URL space into an oracle for which ids are real.
6. No SQL outside the query modules. Components get plain typed objects.
7. Every write logs before/after to `activity_log` **inside the same
   transaction** as the mutation. Never from the route.
8. Never fabricate a value to satisfy a NOT NULL column. A select with no known
   answer gets an empty leading option and **fails validation**. `verified` and
   `rating`/`reviewsCount` are not free-text admin fields.
9. Server components by default. Pagination is a link; search is
   `<form method="GET">`.
10. Validation is pure — `FormData` in, `{ok,data} | {ok:false,errors}` out. No
    DB, no session, no clock. That is what makes it testable without MySQL.

### Decisions copied verbatim — do not re-litigate

- **scrypt from `node:crypto`, not bcrypt.** bcrypt is a native module compiled
  against the Node ABI; on Hostinger's managed Node a platform upgrade turns
  every login into a 500 until someone SSHs in and rebuilds. Store
  `scrypt$N$r$p$salt$key` so params can be raised later, and read N/r/p back out
  of the stored string on verify. OWASP floor N=2^17, r=8, p=1 — Node's default
  `maxmem` (32 MB) is **below** what that needs (~134 MB), so raise `maxmem`
  explicitly or it silently degrades.
- **Every login failure returns the identical message.** Unknown email, wrong
  password, suspended, no password set — one string. Hash against a cached decoy
  on the unknown-email path or timing becomes an enumeration oracle. Check
  "suspended" **after** the password, for the same reason. Real reason to logs
  only.
- **The session cookie carries only** id, role, scope id, `mustChangePassword`.
  Everything else is read from the DB at use time so revocation takes effect
  next request. 8-hour TTL. `httpOnly`, `sameSite: lax`, `secure` in production.
- **No default password anywhere.** Bootstrap generates a random one, prints it
  once, sets `must_change_password`, and **refuses to run if an active admin
  exists** — otherwise it is a shell backdoor for minting admins.
- **`/admin` 404s for the unauthorised, not 403.** "This exists but you may not
  see it" is itself information.
- **`export const dynamic = 'force-dynamic'` on every admin route.** On
  educacion `/admin` was a static placeholder, so any guard added to it would
  never have run.
- **Uploaded photos go to object storage, never the app's disk** — a redeploy
  wipes it. Test by simulating a redeploy before calling upload done.

### Tests

- Per entity: every mutation throws with no session, called **directly against
  the query module**.
- **Canary check:** delete a guard locally and re-run the access tests. If they
  still pass, they are asserting "an error came back" and validation errors
  satisfied them — rewrite to attempt the write, then assert the row is
  unchanged. This exact failure happened on educacion. Restore the guard
  afterwards.

### Copy

Paraguayan voseo (contactanos, solicitá, elegí, tenés), `Gs. 1.450.000`.
Repo, docs and comments in English.

---

## Phase C — Hardening

- [x] Error monitoring (Sentry free tier) + uptime monitor (UptimeRobot)
      *Shipped: `instrumentation.ts` + `sentry.server.config.ts` +
      `sentry.edge.config.ts` (server/edge only — no `sentry.client.config.ts`;
      a client `Sentry.init` roughly doubled the shared JS bundle, 87.8 kB →
      155 kB, for a mostly server-rendered site where 500s and admin-action
      errors matter more than browser render errors). Env-gated like every
      other integration: `SENTRY_DSN` unset → `enabled: false`, no network
      calls, verified the app still boots and serves normally either way.
      `GET /api/health` added for UptimeRobot to poll — deliberately does not
      touch the database, so a MySQL blip doesn't page anyone for a site that
      still serves fine without it.*
      **USER:** create a free Sentry project → `SENTRY_DSN` (+ optionally
      `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for source maps) in the
      Hostinger env panel, redeploy. Create a free UptimeRobot monitor against
      `https://negocio.com.py/api/health`.
- [ ] Watch Hostinger build memory; if OOM: `NODE_OPTIONS=--max-old-space-size=1536`
- [x] Next.js 15/16 upgrade (clears remaining `npm audit` highs) — **own PR, not
      bundled with any Phase B work**
      *Shipped: Next 14.2.35 → 16.3.0, React 18 → 19, `eslint-config-next` →
      16.3.0, `drizzle-orm` → 0.45.2 (SQL-injection fix, GHSA-gpj5-g38j-94v9).
      `npm audit --omit=dev` went from 4 highs (drizzle-orm, nanoid, postcss,
      sharp) to **0**. Applied `@next/codemod`'s `next-async-request-api`
      (every route's `params`/`searchParams` are now `Promise`s, awaited) by
      hand where the codemod reached for the deprecated `UnsafeUnwrapped*`
      escape hatch instead (`lib/auth/session.ts`'s `cookies()`,
      `app/(auth)/ingresar/actions.ts`'s `headers()`) — both now properly
      `await`ed. `AdminForm.tsx` moved from `react-dom`'s deprecated
      `useFormState` to React 19's `useActionState`. `tsconfig.json`'s `jsx`
      is now `"react-jsx"` (Next 16 requires it) with `.next/dev/types`
      added to `include`. `next.config.mjs`'s `eslint` key was removed —
      Next 16 decoupled ESLint from `next build` entirely, so it is no
      longer a recognised option.
      **Evaluated and reverted a real risk before landing:** Next 16's build
      summary claims `/[categoria]` and `/[categoria]/[ciudad]` are
      prerendered (`●`), but `.next/prerender-manifest.json` has no entries
      for them on Next 14, 15 **or** 16 — confirmed identical across all
      three by building the pre-upgrade commit in a separate worktree. Not a
      regression from this PR; these routes were already render-on-request
      with Full Route Cache, not build-time SSG, before this upgrade.
      Verified: `npm run typecheck`/`test`/`build` all pass, a from-scratch
      `npm ci --omit=dev` under `NODE_ENV=production` build passes with
      **0 vulnerabilities**, and `node server.js` boots and serves `/`,
      `/restaurantes`, `/lugar/[slug]` and `/admin` (404, no DB configured)
      correctly with no server-side warnings.*
- [x] Basic e2e smoke tests (Playwright) run in CI
      *Shipped: `playwright.config.ts`, `e2e/smoke.spec.ts` (home, a listing
      page, search, a category page, sitemap.xml, robots.txt, `/api/health`,
      an unknown route 404s, `/admin` 404s with no `DATABASE_URL`), a new `e2e`
      job in `.github/workflows/ci.yml` running against a production build on
      seed data — no database needed.*

## Phase D — Revenue features (ordered by effort→revenue)

1. [x] **Monthly lead report per business** — "Este mes: 47 clics a tu WhatsApp,
       12 consultas". The `leads` table now exists (PR-1); what is still missing
       is the write path — `lib/leads.ts` must persist before it fans out. Leads are currently fire-and-forget at a webhook: if it is down
       the lead is gone and there is no history to report on. This is the
       churn-killer.
       *Shipped: the write path (`lib/leads.ts` persisting before the webhook
       fan-out) landed in PR-2 — this item is the reporting view.
       `lib/hours.ts`'s `asuncionMonthRange()` (pure, unit-tested) computes
       the current calendar month's `[start, end)` in `America/Asuncion`;
       `lib/db/leads-admin.ts`'s `getListingLeadReport()` (guarded
       `['admin', 'editor']` — a per-business count, not the public's contact
       details, so the stricter `listLeads` guard doesn't apply) counts
       `listing_whatsapp`/`listing_message` leads in that range. Rendered as
       a small "Este mes: N clics a su WhatsApp, N consultas" section at the
       top of `/admin/negocios/[id]`. No owner-facing surface — PR-6 (owner
       portal) is still deferred; staff read this themselves for now. No
       migration.*
2. [x] Manual premium sales flow — sell via WhatsApp, invoice via
       Pagopar/Bancard/Tigo Money, set `premiumUntil` in the admin.
       *Shipped: the sale and the invoice happen outside the app (WhatsApp,
       Pagopar/Bancard/Tigo Money — none of that is this app's concern);
       what shipped is applying a sold package fast and correctly.
       `lib/db/listings-admin.ts`'s `extendListingPremium(actor, id, days,
       nowSeconds)` (admin only) takes one of three sold durations
       (`PREMIUM_PACKAGE_DAYS = [30, 90, 365]`, enforced in the query module,
       not just the UI) and extends from the **current expiry** when still
       premium, or from today when expired/never premium — a renewal bought
       before the old package runs out must not shorten what was already
       paid for. Three quick buttons ("+ 30 días" / "+ 90 días" / "+ 1 año")
       on `/admin/negocios/[id]` replace computing and typing a date by
       hand; the existing `verified`/`premiumUntil` form from PR-5 is still
       there for anything the packages don't cover. A "Vender por WhatsApp"
       link (when the listing has a WhatsApp number) opens the sales chat
       with a canned opener. No migration.*
3. [x] "Destacado en portada" — home page featured slots as paid add-on
       *Shipped, with a migration (`drizzle/0002_woozy_tattoo.sql` — one
       nullable additive column + an index, `npm run db:generate` was run,
       `db:migrate` was NOT; apply it by hand before deploying, same as
       every earlier migration). `listings.featured_until` (unix seconds)
       is deliberately separate from `premium_until`: Premium alone
       competes for the home page's general "Negocios destacados" section
       (which shrinks as more businesses go premium), so a featured slot is
       sold separately to guarantee a spot. `MAX_FEATURED_SLOTS = 6`
       (`lib/config.ts`, shared by the public home page and the admin cap
       check so they can't drift) is enforced in
       `lib/db/listings-admin.ts`'s `extendListingFeatured`, not just by how
       many buttons the admin UI shows — a renewal of an already-featured
       listing never counts against the cap, only a brand-new slot does.
       Home page (`app/(public)/page.tsx`) renders a "Destacado en portada"
       section above the general destacados one, via a new
       `ListingQuery.destacado` filter implemented in both providers
       (`isFeaturedSql` for MySQL, `isFeatured()` for the seed engine) so
       local dev without a database still shows the section correctly.
       Design decision made here, not asked: featured slots are sold in
       fixed 30/90-day packages (not arbitrary dates), mirroring PR-5's
       premium-package pattern — reconsider if a business wants a custom
       duration.*
4. [x] QR code per premium listing (printable sticker → profile)
       *Shipped: `qrcode` (pure JS, no native bindings — same reasoning as
       `sharp`/`aws4fetch`) added as a `dependencies` entry, `@types/qrcode`
       likewise (not `devDependencies` — this repo already puts `@types/*`
       in `dependencies` specifically so `next build`'s own type-check
       doesn't fail on Hostinger's `npm ci --omit=dev`; confirmed by
       actually hitting that exact failure with `@types/qrcode` in
       `devDependencies` during the from-scratch production-build
       reproduction, then moving it). `lib/media/qr.ts`'s `listingQrSvg()`
       renders an inline SVG server-side — no external QR service, no
       client component. New route `/admin/negocios/[id]/qr`: a print-
       friendly page (`print:hidden` on the admin nav and page chrome) with
       the code, the business name and its public URL. Linked from the
       listing edit page. Available for any listing, not gated on
       Premium — a business considering Premium can be shown the sticker as
       part of the pitch before buying. No migration.*
5. [x] First-party reviews (UI gate `NEXT_PUBLIC_REVIEWS_ENABLED` already exists)
       *Shipped, with a migration (`drizzle/0003_rare_barracuda.sql` — the new
       `reviews` table; `npm run db:generate` was run, `db:migrate` was NOT.
       Apply it by hand before deploying, same as every earlier migration, or
       `/admin/resenas` and any listing page with reviews enabled 500 on a
       table that does not exist). `reviews` (listing_id → `listings.id`,
       ON DELETE CASCADE — unlike `leads`, a review has no meaning without the
       listing it is about; author, rating 1–5, body, status
       pending/approved/rejected, created_at). Public submission form on the
       listing page behind `NEXT_PUBLIC_REVIEWS_ENABLED` **and**
       `DATABASE_URL` — with no database a submission has nowhere to land, so
       the section and `POST /api/v1/reviews` stay off (the endpoint 404s) and
       local dev / the Playwright run are unaffected. Everything lands as
       `pending`; the status is not a parameter any caller can pass.
       Spam defense mirrors the lead forms — the shared `<Honeypot />` plus a
       per-IP rate limit — but sits in a new `requirePublicWrite`
       (`lib/public-write.ts`), called as the FIRST statement of
       `createPendingReview` in the query module, not in the route: a public
       form has no session to check, and rule 1 is about the query module, not
       the handler. 5 submissions/IP/hour, deliberately far tighter than the
       leads' 5/minute (nobody legitimately writes five reviews an hour). A
       honeypot hit is answered with the same success a visitor sees and
       dropped, exactly like `/api/v1/leads`. Moderation queue at
       `/admin/resenas`, guarded `['admin', 'editor']` — **the split between
       that and `/admin/leads` (admin-only) is "public-facing content" vs "a
       member of the public's contact details": a review carries a display
       name, a rating and a body and no way to reach the author, and editing
       what visitors read on a listing page is already the editor's job. The
       submission form deliberately captures no email or phone, which is what
       keeps that true.** Rejecting is a status change, never a delete, and
       every decision is logged to `activity_log` inside the same transaction
       — which is why the table has no `moderated_by`/`moderated_at` columns.
       **Design fork, decided here: the `reviews` table OWNS
       `listings.rating` and `listings.reviews_count`** — recomputed from the
       approved set on every moderation decision, in the same transaction,
       from scratch rather than incremented. There was nothing to coexist
       with: no `fields.ts` has ever exposed those two columns (rule 8), and
       the only other writer was `scripts/import-seed.ts`, which has been
       stopped from writing them — the seed carries no ratings, so a re-run of
       that idempotent importer would have wiped a real, earned average. No
       approved reviews puts both columns back to NULL, never `0`.
       `AdminTable` gained an optional `rowActions` and an optional
       `editHref`: a queue whose actions are "Aprobar"/"Rechazar" has no edit
       page, and the alternative was a second bespoke table like
       `/admin/leads`'s. Canary run: `requireRole` removed from all four
       functions in `lib/db/reviews-admin.ts` and `requirePublicWrite` from
       `createPendingReview`, 10 of the 17 access tests in
       `tests/reviews-access.test.ts` went red (the other 7 assert the
       positive "an editor/admin CAN reach this", which by design still
       passes), guards restored; 312 → 348 tests. Open questions the PR asks
       rather than guesses: purging rejected reviews, letting an author
       withdraw or edit before moderation, and review-bombing from rotating
       IPs.*
6. [x] SEO content: barrio pages + "Los mejores [rubro] en [ciudad]" pages
       *Shipped: the "[rubro] en [ciudad]" pages already existed from Phase A
       (`/[categoria]/[ciudad]`, title/meta already read "Los mejores…" —
       nothing to add there). What was missing was the barrio level. New
       route `/[categoria]/[ciudad]/[barrio]`, following the exact same
       "never render an empty shell" pattern as the two levels above it
       (§6.3): `zona` is free text an editor typed (BUILD-SPEC-PR4 §1, no
       controlled vocabulary), so the URL segment is `slugify(zona)` and the
       page resolves back to the real string via a new
       `getCategoryCityZonaCombosWithListings()` (implemented in both
       providers — `combosWithZonaListings()` for seed, grouped SQL for
       MySQL). No artificial minimum-listings threshold, same policy the
       rubro×ciudad pages already use — one real listing is enough for a
       real page. Added to `sitemap.xml` and as "Por barrio" internal links
       on the rubro×ciudad page (both SEO wins: more indexed URLs, more
       internal link equity). No migration — `zona` already existed.*
7. [ ] Paid "Verificado" visit as a service *(moved to Wave 3 / gated items — the
       `verified` split it needs ships in W2-2)*
8. [ ] Claim-this-listing flow (WhatsApp OTP) — pairs with PR-6 *(moved to Wave 3 /
       gated items — shares OTP infra with review verification)*

---

## Phase E — Agreed build waves (2026-08-19)

> Source: full repo analysis (public UX, roles/security, tech/build) reviewed
> with the user; every decision below was explicitly confirmed. Build sessions:
> read the **Decisions log**, then take the waves **in order**. Everything in
> Phase B's "Rules that do not bend" and "Decisions copied verbatim" still
> applies to every PR here. Any PR marked **MIGRATION** follows the standing
> rule: `npm run db:generate` in the PR, migration applied **by hand from a
> local machine before merging**, never by a deploy hook.

### Decisions log — confirmed by the user, do not re-litigate

| # | Decision | Outcome |
|---|---|---|
| D1 | English version | **Yes, but last (Wave 3).** `next-intl`, URL prefix `/en` (Spanish stays default at `/`), Spanish slugs kept (`/en/restaurantes/asuncion`), `hreflang`/`alternates.languages` everywhere, locale-aware sitemap. **Guaraní skipped for now** — cheap to add after extraction is done. Cookie-only locale switching rejected (invisible to crawlers). |
| D2 | Listing status | **Yes — first PR of Wave 2.** `draft / published / archived`. Hard delete replaced by archive. |
| D3 | Ownership model (future PR-6) | **`listing_users` join table**, not a single `owner_id` column — supports owner + employees per business and one person owning several businesses. Nothing built now; recorded so the PR-6 session doesn't choose wrong. "Employee" is a row in this table, **not** a new staff role. |
| D4 | New staff roles | **Deferred.** Do the two preparations only: the S1 session fix (W1-2) and the `verified`/premium split (W2-2). `sales` becomes ~1 build when a salesperson is hired; `moderator` likewise if review volume demands it. |
| D5 | Revenue record | **Yes — in-app table** (amount in ₲, method, package, date, seller) written when staff applies a package. |
| D6 | Expiry notifications | **Staff digest first** (weekly "expiring soon" to staff). Automatic messages to businesses: later, not now. |
| D7 | Fake-review defense | **Keep moderation-only for launch; add WhatsApp OTP verification later** together with the claim-listing flow (shared OTP infra, hashed numbers, "Verificado por WhatsApp" badge). |
| D8 | Google reviews/ratings | **Skipped for launch.** If ever revisited: aggregate rating + link only via official Places API (`place_id` stored, nothing else cached), never review text, never in JSON-LD (Google's structured-data rules only allow first-party reviews there). |
| D9 | Small defaults | All accepted: localStorage favorites (W3), ESLint + CI lint job, admin e2e with real MySQL in CI, in-memory rate limiter kept but documented as single-process, migrations stay hand-applied with every migration PR clearly marked. |
| D10 | Pricing | **Keep ₲65.000/mes** on `/precios`; remove the "not final" TODO. |

### Wave 1 — Fixes & hardening *(Sonnet batch; PRs independent unless noted)*

- [x] **W1-1 — Public quick wins.** Fix `components/BottomNav.tsx` "Categorías"
      tab linking to `/precios` (point it at a real categories destination).
      Wire the existing-but-unused `Share` icon (`components/icons.tsx`) into
      `lugar/[slug]` (`navigator.share` with copy-link fallback). Remove the
      pricing TODO on `/precios` (D10). No migration.
      *Shipped: new `/rubros` category index (every live `categoria/ciudad`
      combo linked from one crawlable hub — the mobile tab now points there,
      `rubros` added to `RESERVED_SLUGS` and to the sitemap),
      `components/detail/ShareButton.tsx` (`navigator.share`, clipboard
      fallback, an explicit "no se pudo copiar" state; a cancelled share sheet
      is not treated as a failure) wired into both the premium and free detail
      layouts, pricing TODO removed.*
      **Deviation:** the "Reportar información incorrecta" affordance is
      **not** in this PR. `leads.source` is a MySQL `ENUM`, so a new lead
      source is an `ALTER TABLE` — see **W1-1b** below, which carries it as a
      migration PR. Bundling it here would have made a "no migration" PR
      unmergeable until the database was touched by hand.
- [x] **W1-1b — "Reportar información incorrecta". MIGRATION (`drizzle/0007_*`).**
      Split out of W1-1 (see above). New `listing_report` value in the
      `leads.source` enum, a `listing_report` variant on the zod union in
      `lib/leads.ts`, and a report affordance on `lugar/[slug]` that goes
      through the same lead orchestrator, honeypot and rate limit as every
      other public write.
      *Shipped exactly that: a lead source, not a table of its own — a report
      IS a member of the public telling us something, so it reuses the
      honeypot, the per-IP rate limit, the webhook fan-out, the `leads` table
      and `/admin/leads`. A `reports` table would have duplicated all of it to
      gain one column. `components/detail/ReportForm.tsx` sits collapsed behind
      a `<details>` on both detail layouts: a report link is a footnote on a
      business's page, not something competing with "Llamar". The contact field
      is **optional** — somebody telling us a phone number is wrong is doing us
      a favour, and demanding their email first is how the report does not get
      sent. Verified end to end against MySQL: a POST to `/api/v1/leads` with
      `source: listing_report` lands the row with its slug, message and
      contact.*
- [x] **W1-2 — Session correctness (S1 + S2). MIGRATION (`drizzle/0004_*`).** `requireRole`/`currentUser`
      must re-read `role` and `status` from the DB per request — today a
      suspended or demoted admin keeps access for the cookie's 8-hour TTL,
      while README/ROADMAP claim otherwise; fix the code **and** the docs.
      Invalidate outstanding sessions on password change (e.g.
      `users.password_changed_at` checked against a cookie-issued-at claim —
      if a column is added this is a **MIGRATION** PR). Re-read must live where
      rule 1 lives: covering server actions, not just the layout.
      *Shipped: `users.password_changed_at` (`drizzle/0004_*`), an `issuedAt`
      claim on the cookie stamped by `startSession` and never by a caller, and
      `currentUser()` rewritten to re-read the row on every request — wrapped
      in React `cache()` so one admin render is one query. `role` and
      `mustChangePassword` now come from the ROW, so a demotion applies inside
      server actions too, which is where rule 1 lives. The unverified cookie
      payload is now `sessionClaims()`, with exactly two legitimate callers.
      The decision itself is pure (`lib/auth/session-check.ts`) and has 11
      tests. Both password write paths — the self-service change and the
      admin-issued reset — stamp `password_changed_at`, so a reset signs the
      account out everywhere; the tab doing the change re-issues its own cookie
      and survives. Docs fixed in README and in the Decisions block above, both
      of which claimed this behaviour before the code did it.*
      **Deliberate trade:** a database blip now signs staff out instead of
      serving the admin from an unverified cookie. The public site never calls
      `currentUser()`, so a blip cannot take the site down, and fail-closed is
      the only defensible default for the thing that decides who may write.
- [x] **W1-3 — Caching + perceived performance.** `lugar/[slug]` currently
      hits MySQL on every request while home/sitemap are ISR'd — add
      `export const revalidate` (and `generateStaticParams` if sensible);
      add an explicit `revalidate` to `/[categoria]` and `/[categoria]/[ciudad]`;
      add loading boundaries for the DB-backed public routes. Mind the
      8-connection pool (`lib/db/connection.ts`). No migration.
      *Shipped: `/lugar/[slug]` is ISR (`revalidate = 3600` +
      `generateStaticParams` over the listings that exist at build time,
      defensive so an unreachable database at build degrades to on-demand
      rendering instead of failing the deploy). A tagged **catalogue cache** in
      `lib/listings-repo.ts` (`unstable_cache`, tag `catalog`) covers
      categories, cities and the two live-combo lists — four MySQL round-trips
      that were being repeated on essentially every render. `revalidatePublic()`
      (`lib/admin/revalidate.ts`) drops the tag, the `/lugar/[slug]` segment and
      `/` from every mutating admin action, so staff still get
      read-your-own-writes. In-page `<Suspense>` + `components/Skeletons.tsx`
      around `ResultsSection` on the three landing routes; a route-level
      `loading.tsx` only on `/buscar`.*
      **Deviation (measured, not theoretical):** `loading.tsx` on the four
      routes that call `notFound()` made every 404 answer **HTTP 200** with the
      not-found UI swapped in client-side — a route-level loading boundary
      flushes the response before the page function runs. On a directory site
      that is a soft-404 SEO bug, so those routes stream via an in-page
      `<Suspense>` placed after the `notFound()` check instead. Verified by
      curling the built server: unknown rubro, unknown listing and unknown
      top-level path all answer 404 again.
      **Follow-up fix (same wave, PR after W1-6 found it):** the
      `revalidatePath('/lugar/[slug]', 'page')` shipped here invalidated
      **nothing** — the dynamic-route form matches the app-directory page path
      and this route lives in the `(public)` route group, so a listing renamed
      in the admin kept its old name publicly for the full hour. Replaced with
      `revalidatePath('/', 'layout')`, which takes effect on the very next
      request. The new admin e2e suite (W1-6) is what caught it, which is
      exactly what it was built for.
      **Note:** the `revalidate` added to `/[categoria]` and
      `/[categoria]/[ciudad]` does *not* make those routes ISR — they read
      `searchParams`, so the shell stays dynamic and the value only governs the
      cached reads underneath. The comment in each file says so.
- [x] **W1-4 — Destructive-action safety.** Confirmation step on "Eliminar
      negocio"; `try/catch` on `deleteListingAction`
      (`app/admin/negocios/actions.ts`) like its siblings; rename the shadowed
      `remove` bindings in `app/admin/negocios/[id]/page.tsx`; validate the
      cover-image key against the listing's own gallery in `setCoverImage`
      (`lib/db/listings-admin.ts`) — S6, must land before any owner-facing
      write path ever ships. No migration.
      *Shipped: `deleteListing` now takes a `confirmSlug` and refuses unless it
      matches the row's own slug, compared **inside the transaction** — the
      confirmation is in the query module, not the form, because a server
      action is reachable over HTTP and a UI-only confirmation is decoration
      (rule 2). The form asks staff to type the slug: not a checkbox, not a
      `confirm()` dialog, and it survives JavaScript being off.
      `deleteListingAction` gained the `try/catch` its siblings already had —
      previously any throw (forbidden editor, row already gone) crashed to the
      error boundary. `setCoverImage` validates the key against the listing's
      **own** gallery rows, with row-not-found and key-not-yours returning the
      identical message (rule 5). The shadowed `remove` bindings are now
      `deleteThisListing` / `removeImage`.
      Seven new behaviour tests (355 total). Canary run twice: (a) both new
      guards deleted → the three write-attempt tests went red; (b) `requireRole`
      deleted from all 17 guards in the module → 31 of 61 tests went red.
      Guards restored.*
- [x] **W1-5 — Tooling hygiene.** ESLint: add `eslint.config.mjs`
      (`eslint-config-next`) + lint in CI — today the dep and the `lint`
      script exist but nothing runs. Add a Dependabot config (security bumps).
      Prune `chats/` and `project/` (fold anything still useful into `design/`
      with a README note). Document the single-process assumption in
      `lib/rate-limit.ts` + README (D9). No migration.
      *Shipped: `eslint.config.mjs` (native flat config — `eslint-config-next`
      v16 no longer needs a `FlatCompat` bridge), `npm run lint` repointed from
      the removed `next lint` to `eslint .`, and the **nine real errors** the
      first run found all fixed rather than silenced: unused `Link` import and
      unused `open` prop on `lugar/[slug]`, an unused type import in
      `lib/admin/validation.ts`, and a `react-hooks/exhaustive-deps` ref-in-
      cleanup bug in `ResultsMap`. Two rule overrides are scoped and commented
      rather than global (`require()` in `server.js`; `react-hooks/purity` on
      `app/admin/**/page.tsx`, which are `force-dynamic` server components).
      `.github/dependabot.yml`: monthly, grouped, capped — security alerts are
      not throttled by it. `chats/chat1.md` became `design/BRIEF.md`;
      `project/` (Claude Design canvas exports plus a byte-identical
      `support.js`) removed; `design/README.md` says what each file is and how
      to recover what was pruned. Rate limiter: the three consequences of
      single-process state written up in `lib/rate-limit.ts` and README.*
      **CI shape changed (approved 2026-08-19, "Lean CI"):** four jobs on both
      `push: [main]` and `pull_request` became **one** job on `pull_request` +
      `workflow_dispatch`, now also running lint. Minutes bill per account and
      every job rounds up to a whole minute, so four 90-second jobs cost four
      minutes while one five-minute job doing strictly more costs five. Added
      `concurrency`/`cancel-in-progress` (an agent pushing three commits used
      to leave three runs racing), `paths-ignore` for docs, and
      `timeout-minutes` against GitHub's 360-minute default.
- [x] **W1-6 — Admin e2e in CI.** New CI job with a MySQL service container:
      run migrations + `bootstrap-admin`, then Playwright covering login →
      listing CRUD round-trip → review moderation. This is the bug-insurance
      for every later autonomous build; keep the existing DB-free `e2e`
      coverage as-is. No migration.
      *Shipped: `e2e/admin.spec.ts` (6 tests, serial),
      `playwright.admin.config.ts`, `npm run test:e2e:admin`,
      `.github/workflows/admin-e2e.yml`. Covers the forced password change
      (including that `/admin` cannot be used to skip it), `/admin` 404-ing for
      an anonymous context, listing create → visible publicly → edit → visible
      publicly, a review submitted through the real public endpoint staying
      invisible until approved in the queue, and W1-4's typed-slug delete (the
      wrong confirmation deletes nothing and returns a message; the right one
      removes the listing and the public page 404s). Every assertion is a real
      write against real MySQL. Verified locally against MariaDB 10.11: 6/6.*
      **CI trigger is `workflow_dispatch` only** (Lean CI, agreed 2026-08-19):
      a service container + migrations + seed import + production build + a
      browser costs more minutes than everything else in this repo combined,
      and almost no PR touches the admin. Run it from the Actions tab before
      merging admin/auth/db work.
      **It paid for itself before merging:** its first run against a real
      database found that W1-3's `revalidatePath('/lugar/[slug]', 'page')`
      invalidated nothing, so staff edits never reached the public listing
      page. Fixed in the W1-3 follow-up above.
      **Watch the wait matchers.** `waitForURL('**/admin/negocios**')` also
      matches `/admin/negocios/nuevo` and `/admin/negocios/<id>` — the pages
      the forms are submitted *from* — so it resolved instantly and every
      assertion after it raced the server action. That cost an afternoon and
      briefly produced a wrong diagnosis; the spec now uses an anchored regex
      and says so.
      **Also found, not fixed here:** `getCategories()`/`getCities()` return
      only taxonomy that *has listings*, so a newly created city can never be
      selected on the new-listing form **and** is rejected by the create
      validation — a new city is unusable until a listing already references
      it, which is impossible. Filed for W2-6.

### Wave 2 — Structure & revenue *(W2-1 first; W2-2 before W2-3; rest parallel)*

- [x] **W2-1 — Listing status. MIGRATION (`drizzle/0005_*`). (Opus)** `listings.status`
      enum `draft | published | archived` (default `published` for existing
      rows). Public providers (`db.ts` **and** `seed.ts`), sitemap and SEO
      combos serve only `published`. Admin: status field + filter, "Archivar"
      replaces hard delete in the UI (hard `deleteListing` stays admin-only
      for true mistakes). New listings can be saved as `draft`. Follow the
      PR-4 slice pattern; access tests + canary run as always.
      *Shipped: `listings.status` enum defaulting to `published` (`drizzle/0005_*`,
      plus a `status` index and a `(status, categoria, ciudad)` composite,
      since every public read now leads with it). The public filter lives at
      the top of **`buildListingWhere`** rather than at each call site — that
      function IS the public read path, so a new caller cannot forget it;
      `buildListingWhere` can therefore no longer return `undefined`, and its
      test says so. `db.ts`'s five other reads (by-slug, categories, cities,
      both combo lists) filter explicitly, and `seed.ts` filters too so the two
      providers cannot drift — the seam's whole promise is that a page renders
      the same either way. Sitemap and SEO combos follow automatically, since
      they read through the repo. Admin: a status badge and filter on the list,
      a lifecycle panel on the edit page, `status` on the create form only.
      `setListingStatus` logs `archive` as its own action, so the audit trail
      separates "took this off the site" from "edited a field". 14 new tests
      (424 total); canary → 37 of 78 tests red, guard restored. The admin e2e
      suite gained an archive → 404 → republish → 200 round-trip: 7/7 green.*
      **Two decisions:** status is on the create form and **not** the edit
      form — it moves through its own buttons, so saving a phone number can
      never publish a draft or un-archive a business that closed. And an
      unrecognised `status` value falls back to `draft`, never `published`: a
      typo, a stale cached form or a hand-rolled POST must not be able to put
      something on the public site.
- [x] **W2-2 — Split `verified` out of `setListingFlags`.** Own admin-only
      query-module function + own form section, so `verified` (a human
      assertion) and `premiumUntil` (a sale) stop sharing a write path.
      Prepares both the paid-Verificado product and any future `sales` role.
      No migration.
      *Shipped: `setListingFlags` is gone, replaced by `setListingVerified` and
      `setListingPremiumUntil` — each admin-only, each with its own
      `activity_log` entry, so the audit trail can finally tell a verification
      from an upsell. `parseListingFlagsInput` likewise became
      `parseListingVerifiedInput` / `parsePremiumUntilInput`, and the edit page
      renders two labelled forms instead of one.
      **A real bug fell out of the split:** an unchecked HTML checkbox submits
      **nothing**, so the combined form/parser meant any submission that did not
      render the `verified` checkbox silently set `verified: false`. Saving a
      premium date could un-verify the business. Covered by a test in each
      parser's suite. 14 new tests (362 total); canary run: `requireRole`
      deleted from every guard in `lib/db/listings-admin.ts` → 33 of 64 tests
      went red, guard restored.*
- [x] **W2-3 — Revenue record. MIGRATION (`drizzle/0006_*`).** `sales` table (listing_id, package
      kind premium/featured, days, amount ₲, method Pagopar/Bancard/Tigo/efectivo/otro,
      sold_by from session, created_at). Written **in the same transaction** as
      `extendListingPremium`/`extendListingFeatured` (amount/method become
      required inputs on those forms). `/admin/ventas`: list + month/year
      totals, CSV export. Activity-logged like every mutation.
      *Shipped: the `sales` table (`drizzle/0006_*`), written **inside the same
      transaction** as `extendListingPremium` / `extendListingFeatured`, which
      now take a required `SaleInput`. There is deliberately **no
      `createSale`** anywhere — a sale that can be recorded on its own is a
      sale that can disagree with the thing the money bought, and a test
      asserts the module never grows one. `/admin/ventas` (admin-only): month
      total, a six-month bar list, the ledger and a CSV export reusing
      `lib/admin/csv.ts`. 22 new tests (446 total); canary on the new module →
      6 of 11 red, guard restored. Admin e2e now 9/9, including
      sell-a-package → the row appears in `/admin/ventas`, and
      package-without-an-amount → refused by the server, not just the browser.*
      **Four modelling decisions:** `amount_gs` is an integer, not a decimal —
      the guaraní has no subunit, so a decimal models a precision that does not
      exist. The form accepts `65.000`, `65 000` and `Gs. 65.000`, because that
      is how the number is typed here and rejecting it just means retyping
      until ₲65 gets recorded instead of ₲65.000. `listing_id` is **not** a
      foreign key (same reason as `leads`): a sale is history and must outlive
      a hard-deleted listing, so the business name is denormalised onto the
      row. And amount and method are **required**, never defaulted — a revenue
      table with half its rows at ₲0 because the form allowed a skip looks like
      data and reports nonsense. A real giveaway is `0`, typed.
- [x] **W2-4 — Mail + expiry digest.** Env-gated SMTP (nodemailer,
      `SMTP_*` unset → feature off, app boots fine — same pattern as Sentry/R2).
      Weekly "expiring in ≤14 days" digest (premium + featured) to staff:
      token-guarded `/api/internal/expiry-digest` hit by an external cron
      (cron-job.org / UptimeRobot), since Hostinger's Node app has no cron.
      **This mail infra is also the PR-6 blocker-killer** (password reset by
      email needs exactly this transport). No migration.
      *Shipped: `lib/mail.ts` (nodemailer, all five `SMTP_*` required together
      because a half-configured transport hangs on connect rather than failing
      loudly), `listExpiringSoon` covering **premium and featured in one list**
      — the sales conversation is about the business, not the product, so two
      calls where one would do is the thing to avoid — `lib/admin/digest.ts`
      (pure: listings in, subject and text out, tested without SMTP, a database
      or a clock) and `POST /api/internal/expiry-digest`.
      **The token is the only thing between the public internet and a mail
      send**, so: compared with `timingSafeEqual` rather than `===`; **unset
      means the endpoint 404s**, because "forgot to set it" must never mean
      "open to everyone"; 404 and never 401; and `POST`, because a crawler, a
      link preview or a browser prefetch issues GETs and every one of them
      would send mail. It writes nothing, so a scheduler retrying on a timeout
      sends a duplicate email and corrupts no state. With nothing expiring it
      sends nothing at all. 20 new tests (402 total); canary run → 35 of 67
      tests in `tests/listings-admin-access.test.ts` went red, guard restored.*
      **USER:** set `SMTP_*` + `MAIL_FROM` (Hostinger email works:
      `smtp.hostinger.com`, port 465), generate `EXPIRY_DIGEST_TOKEN` with
      `openssl rand -base64 32`, then point a free weekly cron (cron-job.org)
      at `POST https://negocio.com.py/api/internal/expiry-digest` with
      `Authorization: Bearer <token>`.
- [x] **W2-5 — Reporting polish.** CSV export on `/admin/leads` (admin-only,
      same guard as the list). Month-over-month lead trend (extend
      `asuncionMonthRange` usage to N previous months) on
      `/admin/negocios/[id]` — the renewal-conversation number. No migration.
      *Shipped: `lib/admin/csv.ts` (pure), `listLeadsForExport` (admin-only,
      capped at 5000 rows), `GET /admin/leads/export` carrying the screen's
      current filter; `asuncionMonthRanges(n)` in `lib/hours.ts` and
      `getListingLeadTrend` feeding a six-month bar list on the listing page.
      24 new tests (384 total); canary run on `lib/db/leads-admin.ts` → 8 of 15
      access tests went red, guards restored.*
      **Two things the spec did not ask for, both non-negotiable in hindsight:**
      the CSV neutralises **formula injection** (`=`, `+`, `-`, `@` prefixes are
      executed by Excel and Sheets on open, and these rows are written by
      members of the public, so it is a live attack path on whoever opens the
      export), and it emits a UTF-8 BOM so Excel on Windows does not render
      every `ó` as mojibake. The trend is bucketed **in JavaScript** from one
      query rather than grouped in SQL, because grouping by month in SQL means
      date arithmetic in MySQL's timezone and this app computes time itself.
- [x] **W2-6 — Data quality + admin ergonomics.** Duplicate warning on listing
      create (same name + city ⇒ warn, not block). Minimal bulk action:
      re-categorise selected listings (unblocks category deletion). Per-entity
      activity-log view (filterable, paginated) — the audit trail is written
      faithfully and currently unreadable beyond 10 dashboard rows. No migration.
      *Shipped, plus the taxonomy fix W1-6 turned up:*
      - ***The admin no longer reads the public taxonomy.***
        `listAllCategoryOptions` / `listAllCityOptions` in
        `lib/db/taxonomy-admin.ts` replace `getCategories()`/`getCities()` in
        every admin select AND in the create-form validation. The public reads
        deliberately return only taxonomy that already has listings; used by
        the admin that filter was a trap with no exit — a category or city
        created in the panel was absent from the select and rejected by
        validation, so it could never gain a listing, so it never became
        selectable. Verified end to end against MySQL: a new city now appears
        in the Ciudad select on the next request (9 → 10 options).
      - **Duplicate warning:** `findDuplicateListings` (same name + same city,
        case-insensitive, excluding the row being edited). The first save
        returns the matches with their URLs; saving again goes through. A
        warning, never a block — franchises and two "Farmacia San Roque" on
        different corners are real. `AdminFormState` gained `hidden` to carry
        the acknowledgement, documented as UX state and never permission state.
      - **Bulk re-categorise:** `recategoriseListings`, one transaction, one
        `activity_log` row per listing moved (not one per "bulk action"), the
        target rubro checked against the table rather than against the form's
        options, rows already in the target skipped. Selection is DOM-only
        checkboxes scoped to the visible page — a "select all 2000 matches"
        that reaches beyond what you can see is how a bulk action becomes an
        accident.
      - **`/admin/actividad`:** filter by entity type, entity id and action,
        paginated, admin-only. The log has been written faithfully since PR-3
        and until now only its ten most recent rows were readable anywhere.
      27 new tests (382 total). Canary across all three touched query modules
      → 61 of 120 tests went red, guards restored. The W1-6 admin e2e suite
      passes 6/6 against this branch.

### Wave 3 — Growth *(after Waves 1–2; i18n scaffold on Opus, rest Sonnet)*

- [x] **W3-1 — Discovery UX.** "Negocios similares" on `lugar/[slug]` (same
      rubro + ciudad/zona — conversion + internal-linking SEO, absent today).
      "Cerca de mí" geolocation sort on `/buscar` (lat/lng already modeled
      end-to-end). Search fixes: visible free-text `q` input in `FilterBar`,
      rating sort, pagination windowing. No migration.
      *Shipped: `lib/geo.ts` (pure), `lib/similar.ts` (pure),
      `lib/pagination-window.ts` (pure), `components/detail/SimilarListings.tsx`,
      a visible search field and a "Cerca de mí" button in `FilterBar`, two new
      sorts (`calificacion`, `cerca`) implemented **twice** — once in
      `lib/providers/query.ts` for seed and once in `lib/db/listing-query.ts`
      for MySQL — and a windowed pager. 31 new tests (413 total).*
      **Four decisions worth keeping:**
      - **Coordinates are rounded to three places (~110 m) before they enter
        the URL.** The sort has to live in the query string to stay shareable
        and pageable, which means it also lands in `document.referrer` on every
        outbound link. Three places ranks a city correctly and cannot say which
        building someone is in.
      - **The distance formula lives in `lib/geo.ts` and the SQL mirrors it**,
        with `cos(lat)` computed in the app and bound as a parameter. MySQL
        never does trigonometry, for the same reason `isPremiumSql` takes the
        instant instead of calling `NOW()`: two providers that each derive
        "near" separately will disagree.
      - **Unrated is not zero-rated and un-geocoded is not nearest.** Both sorts
        carry an explicit "is null" key rather than a `COALESCE`, in SQL *and*
        in memory — MySQL's own NULL placement differs between ASC and DESC, so
        the two engines would otherwise agree only by accident.
      - **`sort=cerca` with no point is `relevancia`**, not an empty page. A
        declined location prompt is an answer.
      **A latent bug found on the way:** the four routes that render
      `<Pagination>` each carried their own hand-written list of which query
      params survive a page link. `lat`/`lng` would have been missing from all
      four, and the failure was silent — page 2 would keep `sort=cerca`, drop
      the position, and render an ordinary alphabetical page that looked fine.
      Replaced by one `carriedParams()` in `lib/search-params.ts`.
      **Also fixed, one line:** the desktop header's "Categorías" link still
      pointed at `/buscar`. W1-1 fixed the mobile tab and missed its twin.
      **Canary run twice.** The first run left two guards undetected: the
      "unrated is not zero" and "blank barrio is not a barrio" tests both
      passed against deliberately broken code. Rewritten (the blank-barrio
      candidate is now listed *second*, so a wrong preference reorders it) plus
      five SQL-shape assertions on `buildListingOrderBy`/`buildListingWhere`.
      Second run: 10 of 482 tests red across four query modules, guards
      restored. **One canary is still uncaught and deliberately so** — scoring
      an unrated listing as `0` in the in-memory engine is indistinguishable
      from the correct behaviour while ratings are 1–5. The explicit key stays
      as defence against a future 0, and no test claims to cover it.
- [x] **W3-2 — Favorites (localStorage).** Save/unsave on cards + detail, a
      `/favoritos` page reading localStorage. No accounts, no DB, no migration.
      *Shipped: `lib/favorites.ts` (pure — storage shape, validation, cap, URL
      encoding), `components/FavoriteButton.tsx` (the only file in the app that
      touches `localStorage`), `components/FavoritesSync.tsx`,
      `/favoritos`, a `slugs` filter on `ListingQuery` implemented in both
      providers, and links in the header and footer. 33 new tests (446 total).*
      **The one real design problem, and how it was solved.** README's rendering
      rule is absolute — listing data is server-rendered, *never* fetched from
      the client — and `localStorage` is invisible to the server. So the saved
      list is written into `?ids=` by a small client component and the page is
      rendered by a **server** component from the repo. A saved card therefore
      shows today's phone number and today's premium state, not a snapshot from
      when it was saved, and the favorites page needs no new API surface.
      Shareability falls out for free, which is why the route is `noindex` and
      absent from the sitemap: it is a personal URL, not a page for the index.
      **Slugs, not row ids** — a shareable URL should not carry internal ids.
      **An empty `slugs` array means "no listings", never "no filter".** Spelled
      out explicitly in both providers rather than left to `inArray`, because
      getting it wrong renders the entire directory on an empty favorites page.
      **Storage is treated as untrusted input.** Any script on the origin can
      write `localStorage`, and these values reach a URL and a SQL query, so
      slugs are validated against a narrow pattern on the way in *and* on the
      way out, de-duplicated, and capped at `MAX_PAGE_SIZE` — which also stops a
      hand-written `?ids=` being used to scan the table.
      Canary run: validation loosened to "any non-empty string", the cap
      removed, and the empty-list condition dropped in both providers → 7 of 504
      tests red, guards restored. Smoke-tested against the production build:
      `?ids=<script>` and `?ids=' OR 1=1 --` render zero cards and 200, two real
      slugs render two cards.
- [x] **W3-3 — i18n scaffold. (Opus)** `next-intl`, `/en` route prefix
      (default `/` stays es-PY), locale-aware `generateMetadata` with
      `alternates.languages` + hreflang, locale-aware sitemap, language
      switcher in header/footer. Category/city **labels** become locale-keyed
      lookups; **slugs stay Spanish and canonical**. Ships with only nav/chrome
      translated — the site remains fully Spanish-complete at every step.
      *Shipped: `next-intl` 4.13, `lib/i18n/{routing,request,alternates,metadata,navigation,link}.ts`,
      `messages/{es,en}.json`, `middleware.ts`, `components/LanguageSwitcher.tsx`,
      a locale-aware sitemap, and `lib/fonts.ts`. 21 new tests (503 total).
      **Every Spanish URL is byte-identical to before** — the ten Playwright
      smoke tests pass unmodified, which is the check that mattered.*

      **The app now has TWO root layouts, and that is the load-bearing
      decision.** `app/(site)/[locale]/layout.tsx` for the public site and
      `app/(panel)/layout.tsx` for `/admin` + `/ingresar`; `app/layout.tsx` is
      gone. The obvious shape — one shared root that reads the locale with
      `getLocale()` — was built first and **measurably destroyed W1-3's
      caching**: `getLocale()` is a dynamic request API, so every public page
      went from `●` (ISR, 1h) to `ƒ`, turning every listing view back into a
      MySQL round-trip against an 8-connection pool. Reading the locale from
      the route *segment* keeps it static. Route groups are not part of any
      URL, so no admin path changed.

      **TWO revalidation paths were broken by the move. The W1-6 admin suite
      found both; nothing else could have.** The user flagged this exact risk.
      1. `revalidatePath('/', 'layout')` matched nothing once the public site
         moved under `[locale]` — there is no route at `/` any more — so it
         became a silent no-op with precisely the W1-3 failure signature. The
         first guess, one concrete call per locale (`'/es'`, `'/en'`), **also
         did not work**: a concrete instance of a dynamic segment is not the
         route. Neither is `'/[locale]'` without its route group. The form that
         works is `revalidatePath('/(site)/[locale]', 'layout')` — the
         app-directory path, group and all, exactly the lesson W1-3 already
         recorded one line above it in the same file.
      2. `/admin/resenas` invalidated the public page with its own
         `revalidatePath(listingPath(slug))`, which for the same reason stopped
         matching — an **approved review never appeared on the listing**. That
         call site now goes through `revalidatePublic()` like every other admin
         write; there is one place that knows how public caching works, and
         hand-rolled public paths have now rotted twice.
      All three candidate forms were tried against a **real MySQL and a real
      production build**, because every wrong one fails silently and looks
      identical to working code. Final result: admin e2e **9/9**.

      **The social card was broken too, and is fixed.** `app/opengraph-image.tsx`
      sat at the app root, which no longer has a layout, so it emitted no
      `og:image` at all. Moved under `[locale]`, it then emitted
      `/es/opengraph-image-…`, which the `as-needed` rule **307-redirected** —
      and some social scrapers do not follow redirects for images, on a site
      whose links are shared on WhatsApp. `opengraph-image` is now excluded
      from the middleware at any depth; both cards serve 200, 81 kB, directly.

      **next-intl's ambient request locale does not work in this app, and the
      code says so.** `setRequestLocale` did not propagate to `getTranslations`
      or to the server build of `Link` (measured: `/en` rendered `<html
      lang="en">` and English metadata — both read from `params` — while the
      header, footer and every link fell back to Spanish and to unprefixed
      hrefs). `next/root-params`, the replacement next-intl now points at,
      needs `[locale]` to be a root param of *every* root layout, which it
      cannot be while the panel has a root layout of its own. So the locale is
      threaded **explicitly**: `NextIntlClientProvider` gets an explicit
      `locale` + `messages`, `getTranslations({ locale, namespace })` is used
      instead of the ambient form, and `Link`/`usePathname`/`useRouter` come
      from a `'use client'` module (`lib/i18n/link.tsx`) so they read the
      provider rather than ambient state. **This costs no extra client
      JavaScript** — `next/link` is itself a client component, so those links
      already crossed that boundary.

      **`useSearchParams` in the switcher briefly cost the whole site its ISR
      too.** It sits in the header, i.e. in every public page's layout; a
      dynamic API there opts every page out of static rendering. It is behind
      a `<Suspense>` with a same-size placeholder.

      **A 404 oracle was introduced and closed.** Two root layouts meant two
      `not-found.tsx` files and two sets of default metadata, so `curl /admin`
      answered 404 with `<title>Panel</title>` while every other missing page
      carried the site's title — which defeats "/admin 404s for the
      unauthorised, not 403". The 404 body is now one shared component and the
      defaults one shared `defaultMetadata()`, asserted equal by a test. The
      panel's real routes still set `noindex` in their own layouts. *Residual,
      pre-existing:* `/admin`'s 404 still carries `noindex, nofollow` from the
      admin layout where a normal 404 carries `index, follow` — this predates
      W3-3 and `robots.txt` already lists `/admin` by name.

      **Guaraní stays out (D1)** and is now one `locales` entry plus one
      messages file. The key-parity test is what will fail first.
      Canary run: canonical pointed at the default locale instead of self, the
      panel got its own title back, a category lost its English entry, a
      message key went missing, and the default locale gained a prefix → 6 of
      503 tests red across five modules, all restored. The first attempt left
      the category canary undetected — the silent Spanish fallback satisfied a
      test that only checked "not the raw slug" — so the lookup now exposes
      `untranslatedCategories()` and the test asserts against that.
- [x] **W3-4 — i18n extraction (batch).** Slices (a) home + category/city/barrio
      landing templates, (b) listing detail + cards/pills, (c) buscar + forms +
      reviews, (d) static pages (precios, nosotros, contacto, sumar-negocio).
      ~103 files carry inline Spanish incl. composed sentences — expect ICU
      plurals. Guaraní: not now (D1); nearly free after this.
      *Shipped: every user-facing string on the public site is now in
      `messages/{es,en}.json` — 14 namespaces, ~200 keys. The only Spanish left
      in `components/` and `app/(site)/` is a `›` breadcrumb separator. The
      staff panel is untouched and stays Spanish-only by decision.*
      **Deviation from "each PR shippable": one PR, four commits.** The session
      brief asked for four PRs for all of Wave 3 (W3-1…W3-4), and the slices'
      value was resumability across sessions, which does not apply when they
      are all built in one. It also costs one CI run instead of four.
      **ICU plurals, where they actually are.** The counted sentences on the
      three landing templates and on `/favoritos` are single ICU messages with
      an inline `{count, plural, …}`, not `count + ' negocio' + (s)`. English
      and Spanish happen to agree on one-vs-many; Guaraní will not necessarily,
      and the message is where that gets fixed.
      **Composed sentences were NOT glued from fragments.** `/buscar`'s title is
      the one exception and says so in a comment: which fragments exist depends
      on which filters are set, and a single ICU message with five optional
      slots is unreadable to whoever translates it next. Everywhere else — the
      three "opens tomorrow / opens Monday" variants, the five star ratings —
      each variant is its own whole message.
      **`lib/hours.ts` stopped speaking Spanish.** It is a pure domain module
      answering "is it open right now", and it was also handing back `'hoy'`,
      `'mañana'` and `'Domingo'` — Spanish travelling from a domain function
      into an English page with nowhere left to translate it. It now returns
      `opensDay` + `opensWhen`, and `formatRanges` returns `null` instead of the
      word "Cerrado". The admin keeps its own Spanish day labels: the panel is
      Spanish-only, and those are validation messages, not display copy.
      **Two components became client components, deliberately.** `ListingCard`
      is rendered from a server tree (home) *and* a client one (`SearchView`
      owns the list/map toggle), and a component in a client tree cannot be
      async — so `getTranslations` is unavailable to it and its `Pills`.
      `useTranslations` reads the provider instead. They still server-render to
      HTML; the cost is hydration, not SEO.
      **The social card is now drawn per locale**, and the bug on the way there
      is worth recording: `params` is a Promise in Next 16, so reading
      `params.locale` off the un-awaited Promise silently yielded `undefined`,
      fell back to Spanish, and rendered BOTH cards in Spanish **while their
      `alt` text translated correctly** — invisible unless you diff the two
      PNGs, which is how it was caught.
      **One accepted limitation:** the 404 body always renders in the default
      locale, so `/en/nada` shows an English header around a Spanish 404.
      `not-found.tsx` takes no props; a locale-scoped copy was built and
      measured, and it made the response carry two conflicting 404 headings and
      stopped `/nada` being byte-identical to `/admin` — which is a stated
      security decision. A Spanish sentence on an error page is the cheaper
      defect; `components/NotFoundBody.tsx` records why.
      Verified: 525 unit tests, smoke 10/10, **admin e2e 9/9 against real
      MySQL**, and both locales curled against the production build.

### Wave 3 follow-up — share/structured-data correctness (2026-08-20)

- [x] **W3-5 — The locale move's SEO tail. No migration.** Three defects the
      `[locale]` refactor left behind, all found by curling a production build
      rather than by reading code, and all on the public pages the site is
      actually shared and indexed from.
      *Shipped:*
      **(a) JSON-LD spoke Spanish on English pages.** `lib/jsonld.tsx` built
      every URL as `SITE_URL + path`, so `/en/lugar/x` carried a
      self-referencing canonical of `/en/lugar/x` beside a `LocalBusiness`
      whose `@id` and `url` were the *Spanish* `/lugar/x` — the structured data
      contradicting the canonical on the same page, and the two locale pages
      claiming to be one entity. Breadcrumbs had it too: English labels
      ("Home", "Restaurant") pointing at Spanish URLs. `locale` is now a
      **required** argument on every builder that emits a URL, so a caller that
      forgets it fails to compile instead of silently emitting Spanish. Canary:
      the old expressions restored → 4 of 8 new tests red.
      **(b) Every listing page lost the site-wide `og:` fields.** Next merges
      metadata *shallowly* — a page returning its own `openGraph` replaces the
      layout's outright — so `/lugar/<slug>` shipped `og:title` and
      `og:description` and nothing else: no `og:site_name`, no `og:locale`, no
      `og:type`, no `og:url`, on a site whose distribution is WhatsApp. New
      `siteOpenGraph(path, locale)` in `lib/i18n/metadata.ts` is the one place
      those fields live, and `og:url` is now per-page and locale-prefixed.
      **(c) A business with no cover photo shared with no image at all.** The
      site-wide card documents itself as "auto-applied site-wide" and, because
      of (b), was not: `images: undefined` is a *present key*, so it overrode
      the generated card and emitted nothing. That hit exactly backwards — the
      free listings with no photo are the ones that most need a fallback. Fixed
      with a **per-listing** card at
      `lugar/[slug]/opengraph-image.tsx` (business name + rubro · barrio,
      ciudad, in the page's language), rendered on demand rather than
      prerendered per listing. A listing *with* a photo still wins: the
      explicit `openGraph.images` takes precedence, so this is the fallback,
      not the default.
      Verified: 551 unit tests (8 new), lint + typecheck clean, smoke e2e 10/10,
      and both locales re-curled against a production build — `@id` now
      `/en/lugar/…` on the English page, full `og:` block on every detail page,
      and a real 1200×630 PNG on a photo-less listing in both languages.

- [x] **W3-6 — Password reset by email. MIGRATION (`drizzle/0008_*`).** The
      first half of the owner-portal gate (PR-6: "password reset by email live";
      the transport shipped in W2-4, this is the flow). Staff-only today, and
      reusable unchanged by PR-6 — the owner roles are already in the enum and
      this path never asks what role you are.
      *Shipped: `password_reset_tokens` (user, **SHA-256 of the token**, expiry,
      `used_at`), `lib/auth/reset-token.ts` (pure: mint, hash, TTL, the
      valid/used/expired/unknown decision), `lib/db/password-reset.ts`,
      `/recuperar-contrasena` → email → `/restablecer-contrasena?token=…`.
      **Four decisions worth not re-litigating:**
      **(a) The raw token is never stored** — only its SHA-256, and SHA-256
      rather than scrypt on purpose: the token is 32 bytes of `randomBytes`, so
      there is no dictionary for a slow KDF to defend against. A leaked backup
      yields nothing usable.
      **(b) The request form answers identically** for a real address, an
      unknown one, a malformed one and a suspended account — otherwise it is a
      directory of who works here. The two exceptions are independent of the
      address typed in (rate limit; SMTP unconfigured or refusing), so they
      enumerate nobody. A send failure is surfaced, not swallowed: `lib/mail.ts`
      says so in as many words, and the alternative is somebody staring at
      "check your email" forever.
      **(c) Single use is enforced by the database, not by a read.** Spending a
      token is `UPDATE … WHERE used_at IS NULL`, and its affected-row count
      authorises the password write. A SELECT-then-UPDATE would let two requests
      carrying the same link both pass, the second silently overwriting the
      first. Sibling tokens die in the same transaction.
      **(d) A successful reset does NOT sign you in.** Minting a session there
      would make the mailbox the credential. It stamps `password_changed_at`
      (revoking every open session — the usual reason for a reset is that
      somebody else has a cookie) and redirects to `/ingresar?reset=1`.
      Also: per-address rate limiting on top of per-IP, so a rotating IP pool
      cannot flood one person's mailbox; both routes excluded from locale
      routing like the rest of the panel (`/en/recuperar-contrasena` 404s);
      the sign-in page's "pedile a un administrador" placeholder is now a link.
      21 new tests (572 total), canary on the single-use guard (`affectedOne`
      forced to `true` → the already-spent test goes red), smoke e2e 12/12
      including "a token nobody minted never renders a password form", and the
      three routes curled against a production build.
      **USER: apply `drizzle/0008_*` before merging** (standing rule).

### Gated items (build when their gate is met — decisions already made)

- [ ] **Owner portal (PR-6)** — gate: **≥20 paying businesses** AND password
      reset by email live — **the reset half is now done (W3-6)**, so the only
      remaining gate is the 20 paying businesses. Uses the **`listing_users` join table** (D3 —
      MIGRATION), `scopeToOwner()` that throws on mismatch, a separate narrow
      `fields.ts` (owner never reaches `verified`/`premiumUntil`/`featuredUntil`/
      `slug`/taxonomy), owner edits land in a moderation queue (needs W2-1's
      `status`). Employees of a business = extra join-table rows, not a role.
- [ ] **Claim-this-listing + review verification (WhatsApp OTP)** — one shared
      OTP module (numbers stored **hashed**; a raw phone in `reviews` would
      break the editor-may-moderate privacy line). Claim pairs with PR-6;
      review badge "Verificado por WhatsApp" + one-review-per-number-per-listing
      is D7's upgrade path.
- [ ] **Paid "Verificado" visit** (Phase D item 7) — after W2-2's split;
      sale recorded via W2-3's `sales` table.
- [ ] **`sales` / `moderator` staff roles** — only when hiring demands (D4).
      Cost when triggered: enum ALTER (MIGRATION) + `SATISFIES`/labels +
      per-guard decisions across the query modules + layout widening + tests.

### USER tasks (nothing unblocks these but you)

- [ ] Phase A remainder: Hostinger deploy config, domain + SSL, post-deploy
      smoke test, Search Console, Plausible.
- [ ] Apply any not-yet-applied migrations (`drizzle/0002_*`, `0003_*`) from a
      local machine **before** deploying code that needs them.
- [ ] **Create the Cloudflare R2 bucket + set the five `R2_*`/media env vars** —
      the entire photo-upload path has never run against a real bucket
      (flagged UNTESTED in PR-5) and photos are a premium selling point. Then
      have a build session run the upload → redeploy → photo-survives test.
- [ ] Set `NEXT_PUBLIC_REVIEWS_ENABLED=true` in production when ready to open
      reviews (DB is already required and present).

---

## Phase F — Post-Home_A review findings (2026-09-02)

Findings from the build/architecture/product review that accompanied the
Home_A home-page redesign (PR #52). Ordered by leverage. Each item is one PR
unless noted; "Model" is the model that BUILDS it — Fable only directs and
reviews from the conversation Anton opens, never as a subagent.

Rules for the run: one branch + one PR per item, `npm run typecheck && npm run
lint && npm run test && npm run build` green before every push, Playwright
smoke (`npm run test:e2e`) green for anything touching a public page. Items
marked *migration* need the migration applied by hand before merge (README →
Database). Anton merges when green.

| # | Item | Why it matters | Size | Model | Notes |
|---|---|---|---|---|---|
| F1 | **Self-serve free listing + claim flow.** `/sumar-negocio` creates a `draft` listing (not just a lead), staff approve in `/admin/negocios`; existing listings get a "¿Es tu negocio?" claim link that files a claim for staff to verify by phone/WhatsApp. No owner login yet (PR-6 gate unchanged). | The only growth path today is staff typing every listing by hand. | Large | Opus (design + data model), Sonnet (forms/admin UI) | *migration* (claims table, `listings.source`). Reuse `lib/public-write.ts`, honeypot, rate limiter. |
| F2 | **Live "Abierto ahora" on ISR pages.** Client `OpenStatus` component that recomputes `computeOpenState(hours)` after hydration on home cards and `/lugar/[slug]`; server-rendered value stays as the initial paint. | Home and detail revalidate hourly, so the pill can be wrong for up to 60 min. | Small | Sonnet | Hours already ship in the `Listing` prop; no fetch needed. |
| F3 | **Accent-insensitive search.** Normalised `search_text` column (name + subtitle + description + zona, NFD-stripped, lowercased) with a FULLTEXT index; seed provider folds accents the same way (`lib/db/query-helpers.ts` `normalize`). | "asuncion" vs "Asunción" and "farmacia" vs "Farmácia" currently diverge between providers. | Medium | Sonnet | *migration*. Keep `LIKE` as fallback for < 3-char terms. Add tests to `tests/listing-query.test.ts`. |
| F4 | **Surface ratings on cards and enable reviews.** Show `rating`/`reviewsCount` on `ListingCard` and `FeaturedCard` behind `REVIEWS_ENABLED`; add sort `calificacion` to `FilterBar`; then USER flips `NEXT_PUBLIC_REVIEWS_ENABLED=true`. | Trust signal already built but invisible; drives clicks and Premium value. | Medium | Sonnet | Honesty gate stays: nothing renders without ≥1 approved review. |
| F5 | **Sitemap `lastModified`.** Add `updatedAt` to the public `Listing` shape (DB has it; seed uses import date) and emit it per entry; static pages use build time. | Google has no recrawl signal for edited listings. | Small | Sonnet | No migration if `updated_at` already exists — check `lib/db/schema.ts` first. |
| F6 | **Lead capture into VenderCRM.** Route `sumate`, `contacto` and `listing_whatsapp` leads to VenderCRM's `POST /api/v1/leads` alongside the existing GHL/Sheets hooks; env-gated like the others. | Leads sit in MySQL and a best-effort webhook; nobody works them in a pipeline. | Medium | Sonnet | Follow the `vendercrm-lead-capture` skill. Keep `Promise.allSettled` fan-out. |
| F7 | **Monetisation levers.** (a) annual Premium price row on `/precios` and the home plan table; (b) "Verificado" as a paid add-on toggle in admin (Phase D item 7); (c) per-category sponsorship = `featuredUntil` scoped to a `categoria` (top slot on `/[categoria]`). | Premium is the only SKU; three cheap SKUs on existing plumbing. | Small each | Sonnet (a, b), Opus (c) | (c) is *migration* (`featured_categoria`). |
| F8 | **Hostinger memory cap.** USER sets `NODE_OPTIONS=--max-old-space-size=1536` in the panel; document in README → Deployment. | Phase C OOM item is still open; one build worker does not cap heap. | Small | USER + Sonnet (docs) | |
| F9 | **Dependency minors.** next, eslint-config-next, next-intl, mysql2, zod, @sentry/nextjs, nodemailer, sharp, tsx. Majors (vitest 4, maplibre 6, Tailwind 4, TypeScript 7, ESLint 10, iron-session 9) stay parked. | Safe bumps, security surface. | Small | Sonnet | One PR; run the full CI plus admin e2e manually. |
| F10 | **Test gaps.** e2e: `/buscar?abierto=1`, `/en` home + detail, sitemap contains `/rubros` + a barrio URL; unit: `lib/rate-limit.ts`, `messages/es.json` vs `en.json` key parity. | The items most likely to regress silently. | Small | Sonnet | |
| F11 | **Remove dead weight.** Delete `legacy/` (the pre-Next static site); drop `legacy` from `RESERVED_SLUGS` and the ESLint/tsconfig ignores. | Unreferenced pre-Next static site in every checkout. | Small | Sonnet | *Shipped:* only `legacy/` was dead — `public/businesses/` is **not** dead weight; `lib/providers/seed-data.ts` serves its SVGs as real listing `coverImage`/`gallery` values, so it was left in place. |
| F12 | **Legal page + footer links.** `/terminos` (términos y privacidad) as a static translated page; link from footer "Ayuda". | Home_A footer had it; the site has no privacy text at all. | Small | Sonnet | Copy from Anton or a placeholder marked for review. |

Recommended order: F2, F5, F10, F11, F9 (all small, independent, no
migration) → F4 → F6 → F3 → F7 → F12 → F1 (largest, last, needs the claims
model designed on Opus first). F8 is a panel setting Anton applies any time.

---

## Estimated remaining builds

| Work | Builds | Model |
|---|---|---|
| Wave 1 (W1-1 … W1-6) | 1–2 chats, 6 PRs | Sonnet |
| Wave 2 (W2-1 … W2-6) | 1–2 chats, 6 PRs | Opus for W2-1 (+ review), Sonnet rest |
| Wave 3 (W3-1 … W3-4) | 2–3 chats, ~7 PRs | Opus for W3-3, Sonnet rest |
| Gated: PR-6 owner portal + claim/OTP | 2–3 | Opus |
| Gated: paid Verificado, staff roles | 1 each | Sonnet |

Batching guidance for autonomous runs: Wave 1 PRs are independent — open them
as a batch and merge when green. In Wave 2, W2-1 merges first and W2-2 before
W2-3; W2-4/5/6 are independent. Migration-marked PRs (W2-1, W2-3, possibly
W1-2) must wait for the hand-applied migration before merge — sequence the
batch so non-migration PRs aren't blocked behind them.
