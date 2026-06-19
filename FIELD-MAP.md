# FIELD MAP — `negocio.html` → JetEngine

How every dynamic value on the detail page maps onto a JetEngine meta field /
source. This is the translation key: build a **CPT `negocio`** (or reuse your
existing one), attach a **JetEngine Meta Box** with the fields below, then turn
each value in `negocio.html` into a Dynamic Tag.

The whole template is driven by **one boolean** — `negocio_premium`. Every block
tagged `.is-premium` / `.is-free` in the HTML gets a **Dynamic Visibility**
condition on it (no JS toggle in production — that's preview-only).

## Core post data

| Value on page              | Source / meta field      | JetEngine field type        | Notes |
|----------------------------|--------------------------|-----------------------------|-------|
| Business name (H1)         | **Post Title** (native)  | —                           | Largest element. Used in band (free) and title block (premium). |
| Rubro / category           | **`rubros`** taxonomy     | Taxonomy (term)             | Drives chip + breadcrumb. Also keys the future category-specific block. |
| Subtitle / tagline         | `negocio_subtitulo`       | Text                        | e.g. "Panadería artesanal · Asunción". |
| Description                | `negocio_descripcion`     | Textarea (or WYSIWYG)       | Body lede. Both states. |

## Contact — all point at the BUSINESS, never the platform

| Value                       | Meta field               | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Phone                       | `negocio_telefono`        | Text (tel)                  | FREE: shown plain (no WhatsApp button). PREMIUM: powers the **Llamar** button. `href="tel:{value}"`. |
| WhatsApp number             | `negocio_whatsapp`        | Text (tel, E.164 digits)    | PREMIUM only. `href="https://wa.me/{value}?text=..."`. Appears **exactly once** (rail). |
| Message form recipient      | (uses `negocio_telefono` / form plugin) | —          | PREMIUM only. Routes to the business, not the platform. |

## Gating flags (booleans)

| Value                       | Meta field               | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Premium flag                | **`negocio_premium`**     | Switcher (boolean)          | Master switch. `true` → cover/gallery/contact rail/form/verified-eligible; `false` → band + locked slots + nudge + plain phone. |
| Verified flag               | `negocio_verificado`      | Switcher (boolean)          | PREMIUM only. Shows the small **Verificado** chip beside the name. Condition: `negocio_premium == true AND negocio_verificado == true`. |

## Location

| Value                       | Meta field               | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Street address              | `negocio_direccion`       | Text                        | Both states (text). |
| City / locality             | `negocio_ciudad`          | Text                        | Both states (muted line). |
| Map                         | `negocio_ubicacion`       | **JetEngine Map** field     | PREMIUM only — replaces the stylised `.map` graphic with a real map. |

## Hours — ALWAYS a text day-list, never an image

| Value                       | Meta field               | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Opening hours               | `negocio_horarios`        | **Repeater**                | Render with a JetEngine Listing Grid / Dynamic Repeater. Sub-fields below. |
| ↳ Day label                 | `horario_dia`             | Text (or Select)            | e.g. "Lunes a Viernes". |
| ↳ Time range                | `horario_rango`           | Text                        | e.g. "06:00 – 20:00". (Or split `apertura`/`cierre` Text fields if you prefer.) |

## Photos (PREMIUM)

| Value                       | Meta field               | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Cover photo                 | `negocio_portada`         | Media                       | `.cover` img src. |
| Gallery                     | `negocio_galeria`         | **Gallery**                 | `.thumbs` — loop first 3, optional "+N" overlay. |

## Category-specific block (NEXT PASS — placeholder for now)

Left as a labelled "Próximamente" placeholder in this build. When designed, model
per-rubro fields and show them conditionally on the `rubros` term, e.g.:

| Value (example, Panaderías) | Meta field (suggested)   | Type                        | Notes |
|-----------------------------|--------------------------|-----------------------------|-------|
| Menu / specialties          | `rubro_pan_menu`          | Repeater (item, precio)     | Per-rubro group; show only when term = Panaderías. |
| Highlight items             | `rubro_pan_destacados`    | Gallery / Repeater          | — |

> Pattern: one conditional sub-template per rubro term, swapped into the
> `.category-block` slot. Keep the placeholder until that pass.

---

### Visibility cheat-sheet

```
negocio_premium == false  → .band, .is-free  (plain phone, locked slots, nudge)
negocio_premium == true   → .media, .title-block, .is-premium (cover, gallery,
                            contact rail [WhatsApp + Llamar once], message form)
negocio_premium == true
  AND negocio_verificado  → .chip-verified
```
