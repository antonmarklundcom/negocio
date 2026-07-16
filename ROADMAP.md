# ROADMAP — negocio.com.py

> **This is the working plan.** New Claude Code sessions: read this file first,
> branch off fresh `main`, and update the checkboxes in the same PR as the work.
> Architecture context lives in `README.md`; JetEngine keys in `FIELD-MAP.md`.

## Status

Phase 1 (the full Next.js app) is **done and on `main`**: SSR pages, seed data,
JetEngine provider behind the `lib/listings-repo.ts` seam, lead orchestrator,
maps, SEO, Hostinger entry (`server.js`).

---

## Phase A — Launch *(in progress)*

- [x] Next.js app, seed data, all routes (PR #1)
- [x] Hostinger deploy fixes: build deps + `server.js` (PR #2)
- [x] Extra seed listings (PR #3)
- [x] Favicon + Open Graph image (shares on WhatsApp need a preview)
- [x] GitHub Actions CI: `npm ci && npm run build` on every push/PR
- [x] Lead spam protection: per-IP rate limit + honeypot on all forms
- [x] `sharp` for production image optimization
- [x] Fix: `salud` category renders its `servicios` list (was silently dropped)
- [ ] **USER:** Hostinger panel — Build command `npm run build`, Entry file
      `server.js`, Node 22, env vars from `.env.example` minimum block; deploy `main`
- [ ] **USER:** point domain + SSL at the deployment
- [x] Add analytics (Plausible, cookieless, off until `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set)
- [ ] Post-deploy smoke test on the real domain (`/`, a listing, `/buscar`, sitemap)
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] **USER:** create a Plausible site for the domain, set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, redeploy

## Phase B — Live backend (JetEngine)

- [ ] WordPress: create `negocios` CPT + `categoria`/`ciudad` taxonomies + meta
      fields (see `FIELD-MAP.md`)
- [ ] Create **2–3 TEST businesses** in the panel (not the full real set yet)
- [ ] Verify/correct every key in the `JETENGINE FIELD MAP` block of
      `lib/providers/jetengine.ts` against the live REST payload
- [ ] Implement `parseHours()` for the real repeater shape
- [ ] Set `NEXT_PUBLIC_BACKEND=jetengine` + `NEXT_PUBLIC_PANEL_URL` + app
      password envs; confirm fallback-to-seed still works when panel is down
- [ ] **THEN** bulk-load the real businesses
- [ ] Wire `GHL_WEBHOOK_URL` / `SHEETS_WEBHOOK_URL`; test all 4 lead sources
      end-to-end

## Phase C — Hardening

- [ ] Error monitoring (Sentry free tier) + uptime monitor (UptimeRobot)
- [ ] Watch Hostinger build memory; if OOM: `NODE_OPTIONS=--max-old-space-size=1536`
- [ ] Next.js 15/16 upgrade (clears remaining `npm audit` highs) — own PR
- [ ] Basic e2e smoke tests (Playwright) run in CI

## Phase D — Revenue features (ordered by effort→revenue)

1. [ ] **Monthly lead report per business** — "Este mes: 47 clics a tu WhatsApp,
       12 consultas". Tracking already exists (`listing_whatsapp` /
       `listing_message` leads). This is the churn-killer.
2. [ ] Manual premium sales flow — sell via WhatsApp, invoice via
       Pagopar/Bancard/Tigo Money, set `premium_until` in the panel. No code needed.
3. [ ] "Destacado en portada" — home page featured slots as paid add-on
4. [ ] QR code per premium listing (printable sticker → profile)
5. [ ] First-party reviews (UI gate `NEXT_PUBLIC_REVIEWS_ENABLED` already exists)
6. [ ] SEO content: barrio pages + "Los mejores [rubro] en [ciudad]" pages
7. [ ] Paid "Verificado" visit as a service
8. [ ] (Later, ≥20 paying clients) Self-serve business dashboard (needs auth)

---

## Estimated remaining Claude Code builds

| Work | Builds |
|---|---|
| Phase A remainder (post-deploy checks, analytics) | 0–1 |
| Phase B (field-map verification + lead wiring) | 1–2 |
| Phase C (monitoring, Next upgrade, tests) | 1–2 |
| Phase D items 1, 3, 4, 6 (one each) | ~4 |
| Phase D item 5 (reviews) | 2 |
| Phase D item 8 (dashboard, when justified) | 3–4 |

**≈ 3–5 builds to a fully launched, hardened, live-data site. ≈ 8–12 more to the
full Phase D vision.**
