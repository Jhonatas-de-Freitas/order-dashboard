import type { Page } from '@playwright/test';
import { expect, placeOrder, test, viewAs } from './fixtures';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Principal' });

test('customer does not see the admin screens, in the menu or by address', async ({ page }) => {
  await page.goto('/');

  await expect(menu(page).getByRole('link')).toHaveText(['Loja', 'Pedidos']);

  for (const address of ['/indicadores', '/estoque']) {
    await page.goto(address);
    await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible();
  }
});

test('admin sees the admin screens', async ({ page }) => {
  await page.goto('/');
  await viewAs(page, 'Admin');

  await expect(menu(page).getByRole('link')).toHaveText([
    'Loja',
    'Pedidos',
    'Indicadores',
    'Estoque',
  ]);

  await menu(page).getByRole('link', { name: 'Indicadores' }).click();
  await expect(page.getByText('Total de pedidos')).toBeVisible();

  await menu(page).getByRole('link', { name: 'Estoque' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Saldo de Teclado Mecânico' })).toHaveValue(
    '50',
  );
});

test('indicators follow the orders that were placed', async ({ page }) => {
  const figure = (label: string) =>
    page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
  const number = async (label: string) =>
    Number((await figure(label).innerText()).replace(/[^\d,]/g, '').replace(',', '.'));
  const bar = (panel: string, row: string) =>
    page.getByRole('region', { name: panel }).getByRole('listitem').filter({ hasText: row });
  const count = async (panel: string, row: string) =>
    Number(/\d+$/.exec((await bar(panel, row).locator('p').innerText()).trim())?.[0]);

  await page.goto('/indicadores');
  await viewAs(page, 'Admin');
  await expect(figure('Total de pedidos')).toBeVisible();
  const before = {
    orders: await number('Total de pedidos'),
    revenue: await number('Faturamento confirmado'),
    confirmed: await count('Pedidos por estado', 'Confirmado'),
    cancelled: await count('Pedidos por estado', 'Cancelado'),
    outOfStock: await count('Motivos de cancelamento', 'Sem estoque'),
  };

  const mouse = await placeOrder(page, 'Mouse Sem Fio');
  await expect(mouse.getByText('Confirmado')).toBeVisible();
  const headset = await placeOrder(page, 'Headset USB');
  await expect(headset.getByText('Cancelado')).toBeVisible();

  await menu(page).getByRole('link', { name: 'Indicadores' }).click();
  await expect(figure('Total de pedidos')).toHaveText(String(before.orders + 2));
  await expect.poll(() => number('Faturamento confirmado')).toBeCloseTo(before.revenue + 129.9, 2);
  await expect.poll(() => count('Pedidos por estado', 'Confirmado')).toBe(before.confirmed + 1);
  await expect.poll(() => count('Pedidos por estado', 'Cancelado')).toBe(before.cancelled + 1);
  await expect
    .poll(() => count('Motivos de cancelamento', 'Sem estoque'))
    .toBe(before.outOfStock + 1);
});
