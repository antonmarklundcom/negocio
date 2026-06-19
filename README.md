# negocio.com.py

Directorio de negocios del Paraguay — WordPress + JetEngine front-end.

These static HTML/CSS files are a **design blueprint** that translates 1:1 into
**JetEngine Listing Item templates**. The HTML is semantic, mobile-first, and
every value that varies per business is marked with a `<!-- JETENGINE: ... -->`
comment so it can be swapped for a Dynamic Tag.

## Structure

```
app.js             Zero-dependency Node server (Build 1 runtime, Hostinger Node.js)
package.json       start script: `node app.js`
/index.html        Homepage            — STUB (built last)
/categoria.html    Category / archive  — ✅ BUILT (listing grid)
/negocio.html      Business detail     — ✅ BUILT
/404.html          Not-found page
/css/
  tokens.css       Design-system tokens (:root) — imported by EVERY page
  negocio.css      Detail-page styles (also provides the shared header/footer shell)
  categoria.css    Listing-grid styles
/js/
  preview.js       Free/Premium preview toggle — PREVIEW ONLY, not ported
/assets/           SVG photo placeholders
FIELD-MAP.md       Every dynamic value → JetEngine meta field + type
```

## Build 1 — run it as a Hostinger Node.js site

Build 1 is **static pages served by a tiny Node server** (no JetEngine yet). It
exists so the site can go live on Hostinger Node.js and be seen. The JetEngine
data layer (Next.js + WP API) comes in a later build.

Run locally:

```bash
npm start            # → http://localhost:3000   (routes: / , /negocio , /categoria)
```

Deploy on Hostinger (hPanel → **Node.js**):

1. Create the Node.js app on `negocio.com.py` (the apex must have **no active
   subdomain** when you create it — see the migration notes).
2. Set **Application startup file** → `app.js`, **Node version** → 18+.
3. Deploy the repo (Git deploy from GitHub, or upload). No build step, no
   dependencies — Hostinger just runs `npm start`.
4. Hostinger provides the port via `process.env.PORT`; `app.js` already reads it.

## Shared tokens

`css/tokens.css` is the single source of truth for colour, radius, shadow,
spacing and type. Every page imports it **first**; no page hardcodes a colour.
The `:root` block drops straight into JetEngine → Custom CSS, so re-theming the
whole directory is a one-file edit.

## Build order

Templates are built **detail → category → homepage**, all sharing `tokens.css`
and the same components:

1. **`negocio.html`** (detail) — ✅ done. The richest template; establishes the
   component vocabulary (cards, chips, buttons, locked slots, nudge).
2. **`categoria.html`** (category/archive) — ✅ done. Listing grid of business
   cards; each card carries the same free/premium duality as the detail page
   (free = colour band; premium = band + photo + Verificado ribbon).
3. **`index.html`** (homepage) — still a STUB. Hero + featured rubros, composed
   from the same building blocks. Built in a later pass.

## The detail page: one template, two states

A single template driven by one boolean (`negocio_premium`):

- **Free** — colour header band + plain phone + locked premium slots + a single
  owner-facing upgrade nudge ("Mejorá este perfil").
- **Premium** — photographic cover + gallery, **Verificado** chip, and a contact
  rail (WhatsApp + Llamar) that appears **exactly once** (no duplicate CTA in the
  body on desktop), plus an optional message form.

Every contact action targets the **business**, never the platform. Hours are
always a **text day-list**, never an image. The category-specific block is a
labelled **"Próximamente"** placeholder — rubro variants come in a later pass.

### Previewing locally

Open `negocio.html` and use the **Gratis / Premium** toggle (bottom-right), or
append `?state=free` / `?state=premium` to the URL. That toggle is preview
chrome only — in WordPress, JetEngine **Dynamic Visibility** shows/hides each
`.is-free` / `.is-premium` block based on `negocio_premium`. See `FIELD-MAP.md`.

```bash
# any static server works, e.g.
python3 -m http.server 8000   # → http://localhost:8000/negocio.html
```

## Pushing to the existing GitHub repo

The remote repo already has an auto-generated README, so the histories are
unrelated — the first pull needs `--allow-unrelated-histories`.

```bash
git init                                   # if not already a repo
git add .
git commit -m "Detail page (negocio.html) + shared tokens + stubs"

git remote add origin git@github.com:<user>/negocio.git   # or https URL

# reconcile with the auto-generated README on the remote
git pull origin main --allow-unrelated-histories --no-rebase
# resolve any README.md conflict (keep this one), then:

git push -u origin main
```

If `git push` fails on a transient network error, retry with backoff (2s, 4s,
8s, 16s).
