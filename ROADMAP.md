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
2. [ ] Manual premium sales flow — sell via WhatsApp, invoice via
       Pagopar/Bancard/Tigo Money, set `premiumUntil` in the admin.
3. [ ] "Destacado en portada" — home page featured slots as paid add-on
4. [ ] QR code per premium listing (printable sticker → profile)
5. [ ] First-party reviews (UI gate `NEXT_PUBLIC_REVIEWS_ENABLED` already exists)
6. [ ] SEO content: barrio pages + "Los mejores [rubro] en [ciudad]" pages
7. [ ] Paid "Verificado" visit as a service
8. [ ] Claim-this-listing flow (WhatsApp OTP) — pairs with PR-6

---

## Estimated remaining builds

| Work | Builds | Model |
|---|---|---|
| Phase A remainder (deploy, smoke tests) | 0–1 | user-blocked |
| PR-1 schema + DB provider | 1 | Opus |
| PR-2 cutover + delete WP | 1 | Sonnet |
| PR-3 auth foundation | 1 | Opus |
| PR-4 admin shell + core CRUD | 1–2 | Sonnet, Opus review |
| PR-5 awkward fields | 1–2 | Sonnet, Opus review |
| Phase C | 1–2 | Sonnet |
| Phase D items 1–4, 6 | ~5 | Sonnet |
| PR-6 owner dashboard (when justified) | 2–3 | Opus |
