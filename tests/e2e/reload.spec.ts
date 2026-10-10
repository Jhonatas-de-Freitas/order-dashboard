import { expect, placeOrder, test, viewAs } from './fixtures';

test('an order placed before a reload is still there, with its detail', async ({ page }) => {
  const row = await placeOrder(page, 'Webcam Full HD');
  await row.getByRole('link').click();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^Pedido #[0-9A-F]{8}$/);
  const title = await heading.innerText();

  await page.reload();

  await expect(heading).toHaveText(title);
  await expect(page.getByRole('region', { name: 'Itens' })).toContainText('Webcam Full HD');
});

test('an order that was still moving finishes after a reload', async ({ page }) => {
  const row = await placeOrder(page, 'Teclado Mecânico');
  await expect(row.getByText('Recebido')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Lista de pedidos' }).getByRole('listitem').first(),
  ).toContainText('Confirmado');
});

test('every address opens directly and survives a reload', async ({ page }) => {
  await page.goto('/');
  await viewAs(page, 'Admin');

  const screens = [
    { address: '/', heading: 'Loja' },
    { address: '/pedidos?estado=CONFIRMED', heading: 'Pedidos' },
    { address: '/indicadores', heading: 'Indicadores' },
    { address: '/estoque', heading: 'Estoque' },
    { address: '/endereco-que-nao-existe', heading: 'Página não encontrada' },
  ];
  for (const { address, heading } of screens) {
    await page.goto(address);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    // The persona is part of what a reload has to keep.
    await expect(page.getByRole('banner').getByText('Administrador')).toBeVisible();
  }
});

test('signing out leads to the sign-in screen and back', async ({ page }) => {
  await page.goto('/pedidos');
  await page.getByRole('button', { name: 'Sair' }).click();

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.goto('/estoque');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

  await page.getByRole('button', { name: /Admin Loja/ }).click();
  await expect(page.getByRole('heading', { name: 'Estoque' })).toBeVisible();
});
