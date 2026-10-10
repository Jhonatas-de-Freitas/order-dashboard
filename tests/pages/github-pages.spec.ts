import { expect, test } from '../e2e/fixtures';

// GitHub Pages has no rewrite rules. An address like /order-dashboard/pedidos is not a
// file, so it answers 404 with 404.html, which is a copy of the app.
test.use({ expectedConsoleErrors: /status of 404/ });

test('the published site opens at its base address', async ({ page }) => {
  const response = await page.goto('./');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Loja' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aumentar Teclado Mecânico' })).toBeVisible();
});

test('an inner address opens directly and survives a reload', async ({ page }) => {
  const response = await page.goto('./pedidos?estado=CONFIRMED');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmado' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('region', { name: 'Lista de pedidos' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/order-dashboard\/pedidos\/[0-9a-f-]{36}$/);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^Pedido #[0-9A-F]{8}$/);
  const title = await heading.innerText();

  await page.reload();

  await expect(heading).toHaveText(title);
});

test('links stay under the base address', async ({ page }) => {
  await page.goto('./');

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Pedidos' })
    .click();

  await expect(page).toHaveURL(/\/order-dashboard\/pedidos$/);
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
});
