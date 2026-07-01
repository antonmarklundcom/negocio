# Business cover images

Cover photos for the seeded businesses, referenced by `coverImage` in
`lib/providers/seed-data.ts`.

The `*.svg` files here are **on-brand placeholders** (same gradient style as
`/public/seed`). To use a real photo:

1. Optimise the photo (~1200px wide, JPEG/WebP, < 300 KB — try squoosh.app).
2. Drop it in this folder, e.g. `dentista.jpg`.
3. In `lib/providers/seed-data.ts`, change that listing's `coverImage`
   from `/businesses/dentista.svg` to `/businesses/dentista.jpg`.

For hundreds of images, don't commit them here — serve them from the CMS media
library (`panel.negocio.com.py`, already allow-listed in `next.config.mjs`) or
an object-storage/CDN bucket and reference the URLs. See the notes handed over
with this change.
