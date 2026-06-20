# FIELD MAP — JetEngine `negocios` → `Listing`

How every field of the app's `Listing` type (see `lib/types.ts`) maps onto the
WordPress/JetEngine REST payload. **All of this lives in one place:**
`lib/providers/jetengine.ts`, inside the block marked
`// === JETENGINE FIELD MAP ===`. Correct the keys there and nowhere else.

> The meta keys below are **UNVERIFIED guesses** until checked against the live
> post type. Each line in `jetengine.ts` carries a
> `// TODO: verify field key against live JetEngine`. A missing field maps to
> `undefined` and never hard-fails; a down panel degrades to the seed.

## Post type & auth

- Custom post type: **`negocios`** → `GET /wp-json/wp/v2/negocios?_embed=1`
- Auth: **Application Password (Basic Auth)**, `WP_APP_USER` / `WP_APP_PASSWORD`,
  **server-side only** — never shipped to the client.
- Activate with `NEXT_PUBLIC_BACKEND=jetengine` + `NEXT_PUBLIC_PANEL_URL`.

## Core post data

| `Listing` field | Source | Notes |
|---|---|---|
| `name` | **Post title** | — |
| `slug` | Post slug | Public URL at `/lugar/{slug}`. |
| `description` | Post content → excerpt fallback | HTML is stripped. |
| `subtitle` | meta `subtitulo` | e.g. "Cocina paraguaya". |

## Taxonomies (from `_embed` → `wp:term`)

| `Listing` field | Taxonomy | Notes |
|---|---|---|
| `categoria` / `categoriaLabel` | **`categoria`** | Term slug must match `lib/categories.ts`. |
| `ciudad` / `ciudadLabel` | **`ciudad`** | Term slug must match `lib/cities.ts`. |
| `zona` | meta `zona` | Barrio (free text). |

## Contact — always the BUSINESS, never the platform

| `Listing` field | meta key | Notes |
|---|---|---|
| `phone` | `telefono` | Free: plain text. Premium: `tel:` + "Llamar". |
| `whatsapp` | `whatsapp` | E.164 digits for `wa.me`. Premium only in UI. |
| `email` | `email` | — |
| `website` | `sitio_web` | — |
| `instagram` | `instagram` | Handle. |

## Location

| `Listing` field | meta key | Notes |
|---|---|---|
| `address` | `direccion` | — |
| `lat` / `lng` | `lat` / `lng` (or `latitud`/`longitud`) | Drives the MapLibre map. |

## Hours (drives "Abierto ahora", America/Asuncion)

| `Listing` field | meta key | Notes |
|---|---|---|
| `hours` | `horarios` | Expected shape: `DayHours[]` (`{ day:0–6, ranges:[{open,close}] }`). The repeater shape from JetEngine must be reshaped in `parseHours()` — see its TODO. |

## Photos

| `Listing` field | Source | Notes |
|---|---|---|
| `coverImage` | **Featured image** (`wp:featuredmedia`) → meta `cover` | Premium hero. |
| `gallery` | meta `galeria` | Array of URLs. Premium gallery. |

## Category block (premium, render-only-if-present)

| `Listing` field | meta key | Block variant |
|---|---|---|
| `especialidades` | `especialidades` | food / default (chips) |
| `destacadoItem` | (model as group) | food ("Menú del día") |
| `productos` | (model as repeater) | shop |
| `servicios` | (model as repeater) | service |

The variant is chosen by the category's `blockKind` in `lib/categories.ts`.

## Flags / monetization

| `Listing` field | meta key | Notes |
|---|---|---|
| `verified` | `verificado` | Switcher → "Verificado" chip. |
| `premiumUntil` | `premium_until` | **Unix seconds.** `isPremium = premiumUntil > now`. Unlocks cover, gallery, WhatsApp, category block, sticky bar. |

## Honesty-gated (do NOT populate at launch)

`rating`, `reviewsCount`, `reviews`, `yearsActive`, `avgResponseMins` only render
when real data exists, and the reviews UI is gated behind
`NEXT_PUBLIC_REVIEWS_ENABLED` (default `false`). Never fabricate ratings.
