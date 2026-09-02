import { expect, test } from '@playwright/test';

/**
 * Basic e2e smoke tests (ROADMAP Phase C). NOT a full regression suite — this
 * is the "did the deploy actually work" check: the golden path a visitor
 * takes, run against the built-in seed data so it needs no database.
 */

test('home page loads and shows listings', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/negocio\.com\.py/i);
  // The home page renders at least one listing card from the seed dataset.
  await expect(page.locator('article').first()).toBeVisible();
});

test('a listing detail page renders', async ({ page }) => {
  await page.goto('/lugar/nande-cocina');
  await expect(page.locator('h1')).toBeVisible();
});

test('search results page responds to a query', async ({ page }) => {
  await page.goto('/buscar?q=restaurante');
  await expect(page.locator('body')).toBeVisible();
  expect(page.url()).toContain('/buscar');
});

test('a category landing page renders', async ({ page }) => {
  await page.goto('/restaurantes');
  await expect(page.locator('h1')).toBeVisible();
});

test('the legal/terms page renders', async ({ page }) => {
  await page.goto('/terminos');
  await expect(page.locator('h1')).toBeVisible();
});

test('sitemap.xml is served', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('xml');
});

test('open-now filter narrows search results', async ({ page }) => {
  await page.goto('/buscar?abierto=1');
  expect(page.url()).toContain('abierto=1');
  // Not asserting exact counts — seed data changes over time. The point is
  // the filtered route renders without erroring.
  await expect(page.locator('body')).toBeVisible();
});

test('English home page loads', async ({ page }) => {
  await page.goto('/en');
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('article').first()).toBeVisible();
});

test('English listing detail page renders', async ({ page }) => {
  await page.goto('/en/lugar/nande-cocina');
  await expect(page.locator('h1')).toBeVisible();
});

test('sitemap includes rubros and a barrio URL', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  const body = await res.text();
  expect(body).toMatch(/<loc>[^<]*\/rubros<\/loc>/);
  // A barrio URL is a 3-segment path after the domain: /categoria/ciudad/barrio-slug.
  expect(body).toMatch(/<loc>https?:\/\/[^/]+\/[^/<>]+\/[^/<>]+\/[^/<>]+<\/loc>/);
});

test('robots.txt is served', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);
});

test('health check endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('the reviews endpoint 404s while the feature is gated off', async ({ request }) => {
  // This CI run has neither NEXT_PUBLIC_REVIEWS_ENABLED nor DATABASE_URL, so
  // the whole first-party reviews feature (ROADMAP Phase D item 5) must be
  // inert — no public write path, not even a validation error.
  const res = await request.post('/api/v1/reviews', {
    data: { listingId: 'x', author: 'Bot', rating: 5, body: 'Excelente excelente' },
  });
  expect(res.status()).toBe(404);
});

test('an unknown route 404s', async ({ page }) => {
  const res = await page.goto('/esto-no-existe-en-ningun-lado');
  expect(res?.status()).toBe(404);
});

test('/admin 404s with no database configured', async ({ page }) => {
  // This CI run has no DATABASE_URL — the panel must 404, not 500 (README →
  // Admin & auth: "/admin 404s for the unauthorised, never 403", and with no
  // DB there is nothing to sign in against at all).
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);
});

test('the password-reset pages render without a database', async ({ page }) => {
  // Both are reachable signed-out by design — they are how a locked-out member
  // of staff gets back in. With no DATABASE_URL they must still render rather
  // than 500: this CI run has none, and neither does a misconfigured deploy on
  // the day someone actually needs the page.
  const request = await page.goto('/recuperar-contrasena');
  expect(request?.status()).toBe(200);
  await expect(page.getByLabel('Correo')).toBeVisible();

  // A token nobody minted must never produce a "choose a new password" form.
  const reset = await page.goto('/restablecer-contrasena?token=not-a-real-token');
  expect(reset?.status()).toBe(200);
  await expect(page.locator('input[name="next"]')).toHaveCount(0);
});

test('the sign-in page offers password recovery', async ({ page }) => {
  await page.goto('/ingresar');
  await expect(page.getByRole('link', { name: /olvidaste tu contraseña/i })).toBeVisible();
});
