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
  own listing.

### The PR sequence — one PR each, in order, nothing parallel

- [ ] **PR-1 — Schema + DB provider.** Drizzle + `mysql2` + vitest. Tables from
      `lib/types.ts`, never from JetEngine's meta keys. `lib/providers/db.ts`
      implements `ListingsProvider`. Seed data becomes an idempotent `tsx`
      import script keyed on `slug`. Migrations are generated in the repo and
      **applied from a local machine** — every later PR is planned around that,
      or code lands needing a column nobody applied and 500s in production.
- [ ] **PR-2 — Cutover + cleanup.** Flip `selectPrimary()` to the DB provider;
      delete `lib/providers/jetengine.ts`, `FIELD-MAP.md`, the WP env vars, and
      `withFallback`. *(Moved ahead of the admin: with no WP data there is
      nothing to watch for a day, and leaving `withFallback` alive through the
      admin PRs means a DB error silently serves stale seed data and looks
      fine.)*
- [ ] **PR-3 — Auth foundation.** `iron-session`, `node:crypto` scrypt, `users`
      table, `requireRole()`, `scopeToOwner()`, login/logout, forced password
      change, `scripts/bootstrap-admin.ts`. **This is the PR to get right;**
      PR-4 and PR-5 are mechanical once its two functions exist.
- [ ] **PR-4 — `/admin` shell + core CRUD.** Listings, categories, cities. One
      `AdminTable` (server component), one `AdminForm` (the only client
      component in the entire admin), one pure validation module, `activity_log`
      on every write.
- [ ] **PR-5 — The awkward fields.** Hours editor, gallery/photo upload to
      object storage, `premiumUntil`, the `verified` flag, staleness/expiry
      dashboard.
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

- [ ] Error monitoring (Sentry free tier) + uptime monitor (UptimeRobot)
- [ ] Watch Hostinger build memory; if OOM: `NODE_OPTIONS=--max-old-space-size=1536`
- [ ] Next.js 15/16 upgrade (clears remaining `npm audit` highs) — **own PR, not
      bundled with any Phase B work**
- [ ] Basic e2e smoke tests (Playwright) run in CI

## Phase D — Revenue features (ordered by effort→revenue)

1. [ ] **Monthly lead report per business** — "Este mes: 47 clics a tu WhatsApp,
       12 consultas". **Blocked on persisting leads to the `leads` table
       (PR-1).** Leads are currently fire-and-forget at a webhook: if it is down
       the lead is gone and there is no history to report on. This is the
       churn-killer.
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
