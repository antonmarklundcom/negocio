import { expect, test, type Page } from '@playwright/test';

/**
 * The MySQL-backed admin round-trip (ROADMAP W1-6).
 *
 * This is the bug insurance for every later autonomous build: the DB-free
 * smoke suite cannot reach `/admin` at all (it 404s without `DATABASE_URL`),
 * so nothing was ever exercising login, the guards, the CRUD slices or the
 * moderation queue end to end. Everything below is a REAL write against a real
 * database — no fakes, no mocks, no seeded fixtures beyond `db:import-seed`.
 *
 * It runs against `playwright.admin.config.ts`, never the default config, and
 * needs three env vars the harness sets:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — from `scripts/bootstrap-admin.ts`
 *   PLAYWRIGHT_BASE_URL (optional) — otherwise it builds and starts the app
 *
 * Serial, not parallel: every test shares one administrator account and one
 * listing, and the password change in the first test is what makes the rest
 * reachable at all.
 */

test.describe.configure({ mode: 'serial' });

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const BOOTSTRAP_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Chosen to clear the app's own strength rules with no margin for argument. */
const PASSWORD = 'e2e-Contrasena-Larga-2026!';

/** Unique per run, so a re-run against a dirty database does not collide. */
const SLUG = `e2e-negocio-${Date.now().toString(36)}`;
const NAME = 'E2E Panadería de Prueba';
const RENAMED = 'E2E Panadería Renombrada';

/** The listing id, captured in the create test and used by the ones after it. */
let listingId = '';

/**
 * The listings index, and ONLY the index. `'**\/admin/negocios**'` would also
 * match `/admin/negocios/nuevo` and `/admin/negocios/<id>` — the pages the
 * forms are submitted from — so `waitForURL` would resolve instantly and every
 * assertion after it would race the server action it was meant to wait for.
 * That cost an afternoon; do not loosen it.
 */
const LISTINGS_INDEX = /\/admin\/negocios(\?|$)/;

async function signIn(page: Page, password: string) {
  await page.goto('/ingresar');
  // Fields are located by their `name`, not their label text: `AdminForm`
  // appends a red " *" to every required label, so label matching is exact
  // only by accident.
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.beforeAll(() => {
  // Fail loudly rather than reporting a green run that authenticated as nobody.
  expect(EMAIL, 'E2E_ADMIN_EMAIL must be set by the harness').not.toBe('');
  expect(BOOTSTRAP_PASSWORD, 'E2E_ADMIN_PASSWORD must be set by the harness').not.toBe('');
});

test('a bootstrapped administrator must change the password before reaching the panel', async ({
  page,
}) => {
  await signIn(page, BOOTSTRAP_PASSWORD);

  // `must_change_password` is set by the bootstrap script; the admin layout
  // redirects rather than rendering. This is the assertion that the forced
  // change is real and not just a flag nobody reads.
  await page.waitForURL('**/cambiar-contrasena');

  // And it must not be escapable by simply asking for the panel.
  await page.goto('/admin');
  await page.waitForURL('**/cambiar-contrasena');

  await page.locator('input[name="current"]').fill(BOOTSTRAP_PASSWORD);
  await page.locator('input[name="next"]').fill(PASSWORD);
  await page.locator('input[name="repeat"]').fill(PASSWORD);
  await page.getByRole('button', { name: /guardar|cambiar/i }).click();

  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the panel is not reachable without a session', async ({ browser }) => {
  // A fresh context: no cookie. `/admin` must 404, not 403 and not redirect —
  // "this exists but you may not see it" is itself information.
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  });
  const fresh = await context.newPage();
  const res = await fresh.goto('/admin');
  expect(res?.status()).toBe(404);
  await context.close();
});

test('create a listing, and it reaches the public site', async ({ page }) => {
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');

  await page.goto('/admin/negocios/nuevo');
  await page.locator('input[name="name"]').fill(NAME);
  // ROADMAP W2-1: new listings default to `draft`, so the public assertions
  // below only mean anything if this run publishes deliberately.
  await page.locator('select[name="status"]').selectOption('published');
  await page.locator('input[name="slug"]').fill(SLUG);
  await page.locator('select[name="categoria"]').selectOption('restaurantes');
  await page.locator('select[name="ciudad"]').selectOption('asuncion');
  await page
    .locator('textarea[name="description"]')
    .fill('Creado por la suite e2e del panel. Pan casero todos los días.');
  await page.getByRole('button', { name: /guardar|crear/i }).click();

  await page.waitForURL(LISTINGS_INDEX);

  // Search rather than scanning the first page: the seed import puts 33
  // listings in the table and the list is paginated at 25. The row's only
  // link is labelled "Editar", so the name identifies the row and the link
  // carries the id.
  await page.goto(`/admin/negocios?q=${encodeURIComponent(NAME)}`);
  const row = page.getByRole('row').filter({ hasText: NAME });
  await expect(row).toHaveCount(1);

  const href = await row.getByRole('link', { name: 'Editar' }).getAttribute('href');
  listingId = href?.split('/').pop() ?? '';
  expect(listingId, 'the listing edit link should carry the new row id').not.toBe('');

  // The public read path. `/lugar/[slug]` is ISR (W1-3), so this also proves
  // `revalidatePublic()` actually drops the segment on a staff write — a stale
  // cache here would show a 404 for a listing that exists.
  await page.goto(`/lugar/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME);
});

test('edit the listing, and the change reaches the public site', async ({ page }) => {
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');

  await page.goto(`/admin/negocios/${listingId}`);
  await page.locator('input[name="name"]').fill(RENAMED);
  await page.getByRole('button', { name: /guardar/i }).first().click();

  await page.waitForURL(LISTINGS_INDEX);
  await page.goto(`/admin/negocios?q=${encodeURIComponent(RENAMED)}`);
  await expect(page.getByRole('row').filter({ hasText: RENAMED })).toHaveCount(1);

  await page.goto(`/lugar/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(RENAMED);
});

test('a pending review is invisible publicly until it is approved', async ({ page, request }) => {
  // Submitted through the real public endpoint, not inserted behind its back:
  // the point is that the whole path lands a row in `pending`.
  const res = await request.post('/api/v1/reviews', {
    data: {
      listingId,
      author: 'Visitante E2E',
      rating: 5,
      body: 'Excelente atención y el pan sale calentito. Volvería sin dudarlo.',
    },
  });
  expect(res.ok(), await res.text()).toBe(true);

  await page.goto(`/lugar/${SLUG}`);
  await expect(page.getByText('Visitante E2E')).toHaveCount(0);

  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');
  await page.goto('/admin/resenas');
  await expect(page.getByText('Visitante E2E')).toBeVisible();

  // Not `waitForURL('**/admin/resenas**')`: the action redirects back to the
  // page it was submitted from, so that glob matches before anything happens.
  // The row leaving the pending queue is the actual completion signal.
  await page.getByRole('button', { name: 'Aprobar' }).first().click();
  await expect(page.getByText('Visitante E2E')).toHaveCount(0);

  await page.goto(`/lugar/${SLUG}`);
  await expect(page.getByText('Visitante E2E')).toBeVisible();
});


test('archiving takes a listing off the public site without losing it', async ({ page }) => {
  // ROADMAP W2-1 / D2. This is the behaviour that replaces hard deletion for
  // "the business closed": gone from the public site, still in the admin.
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');

  await page.goto(`/admin/negocios/${listingId}`);
  // NOT waitForURL: the action redirects back to the page it was submitted
  // from, so any URL matcher is already satisfied before anything happens.
  // The badge changing is the real completion signal.
  await page.getByRole('button', { name: 'Archivar' }).click();
  await expect(page.getByText('Archivado', { exact: true })).toBeVisible();

  const gone = await page.goto(`/lugar/${SLUG}`);
  expect(gone?.status()).toBe(404);

  // Still in the admin, and still findable.
  await page.goto(`/admin/negocios?q=${encodeURIComponent(RENAMED)}`);
  await expect(page.getByRole('row').filter({ hasText: RENAMED })).toHaveCount(1);

  // And it comes back.
  await page.goto(`/admin/negocios/${listingId}`);
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible();

  const back = await page.goto(`/lugar/${SLUG}`);
  expect(back?.status()).toBe(200);
});

test('selling a package records the sale in the same breath', async ({ page }) => {
  // ROADMAP W2-3 / D5. The amount and the method are required inputs on the
  // package form, and the row lands in `sales` inside the package's own
  // transaction — so this asserts both halves in one action.
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');
  await page.goto(`/admin/negocios/${listingId}`);

  await page.locator('#premium-amount').fill('65.000');
  await page.locator('#premium-method').selectOption('efectivo');
  await page.getByRole('button', { name: '+ 30 días' }).first().click();
  await page.waitForURL(`**/admin/negocios/${listingId}**`);

  await page.goto('/admin/ventas');
  const row = page.getByRole('row').filter({ hasText: RENAMED });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('65.000');
  await expect(row).toContainText('Efectivo');
  await expect(row).toContainText('Premium');
});

test('a package with no amount is refused, and sells nothing', async ({ page }) => {
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');
  await page.goto(`/admin/negocios/${listingId}`);

  // The method is chosen but the amount is left blank. `noValidate` is not set
  // on this form, so the browser blocks it — clear `required` to prove the
  // SERVER refuses too, which is the half that matters.
  await page.locator('#premium-amount').evaluate((el) => el.removeAttribute('required'));
  await page.locator('#premium-method').selectOption('efectivo');
  await page.getByRole('button', { name: '+ 30 días' }).first().click();

  await expect(page.getByText(/monto de la venta/i)).toBeVisible();
});

test('deleting requires the slug typed back, then removes the listing', async ({ page }) => {
  await signIn(page, PASSWORD);
  await page.waitForURL('**/admin');
  await page.goto(`/admin/negocios/${listingId}`);

  // W1-4: the wrong confirmation must not delete anything, and must come back
  // with a message rather than crashing to the error boundary.
  await page.locator('input[name="confirm"]').fill(`${SLUG}-no`);
  await page.getByRole('button', { name: 'Eliminar negocio' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(`/lugar/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(RENAMED);

  await page.goto(`/admin/negocios/${listingId}`);
  await page.locator('input[name="confirm"]').fill(SLUG);
  await page.getByRole('button', { name: 'Eliminar negocio' }).click();

  await page.waitForURL(LISTINGS_INDEX);
  await page.goto(`/admin/negocios?q=${encodeURIComponent(RENAMED)}`);
  await expect(page.getByRole('row').filter({ hasText: RENAMED })).toHaveCount(0);

  const gone = await page.goto(`/lugar/${SLUG}`);
  expect(gone?.status()).toBe(404);
});
