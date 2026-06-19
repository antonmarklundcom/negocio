# negocio.com.py

Directorio de negocios del Paraguay — WordPress + JetEngine front-end.

These static HTML/CSS files are a **design blueprint** that translates 1:1 into
**JetEngine Listing Item templates**. The HTML is semantic, mobile-first, and
every value that varies per business is marked with a `<!-- JETENGINE: ... -->`
comment so it can be swapped for a Dynamic Tag.

## Structure

```
/index.html        Homepage            — STUB (built last)
/categoria.html    Category / archive  — STUB (built second)
/negocio.html      Business detail     — ✅ BUILT (this pass)
/css/
  tokens.css       Design-system tokens (:root) — imported by EVERY page
  negocio.css      Detail-page styles
/js/
  preview.js       Free/Premium preview toggle — PREVIEW ONLY, not ported
/assets/           SVG photo placeholders
FIELD-MAP.md       Every dynamic value → JetEngine meta field + type
```

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
2. **`categoria.html`** (category/archive) — listing grid of business cards.
   Reuses the tokens + card/chip components from the detail page.
3. **`index.html`** (homepage) — hero + featured rubros, composed from the same
   building blocks.

> Only the detail page is built in this pass. Homepage and category are labelled
> stubs — confirm scope before building them.

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
