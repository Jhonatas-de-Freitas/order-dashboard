import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, orderList, test, viewAs } from './fixtures';

/** Opens each main screen in turn and hands it to `check` once its content is there. */
async function visitMainScreens(page: Page, check: (screen: string) => Promise<void>) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Aumentar Teclado Mecânico' })).toBeVisible();
  await page.getByRole('button', { name: 'Aumentar Teclado Mecânico' }).click();
  await check('loja');

  await page.goto('/pedidos');
  await expect(orderList(page).getByRole('listitem').first()).toBeVisible();
  await check('pedidos');

  await orderList(page).getByRole('listitem').first().getByRole('link').click();
  await expect(page.getByRole('region', { name: 'Notificações' }).getByText('Enviada')).toHaveCount(
    4,
  );
  await check('detalhe do pedido');

  await page.goto('/pedidos?estado=CANCELLED');
  await orderList(page).getByRole('listitem').first().getByRole('link').click();
  await expect(page.getByText(/^Motivo: /)).toBeVisible();
  await check('detalhe de pedido cancelado');

  await page.goto('/indicadores');
  await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible();
  await check('sem acesso');

  await viewAs(page, 'Admin');
  await expect(page.getByText('Total de pedidos')).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  await check('indicadores');

  await page.goto('/estoque');
  await expect(page.getByRole('spinbutton', { name: 'Saldo de Headset USB' })).toBeVisible();
  await check('estoque');

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await check('entrar');
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`main screens have no accessibility violations in the ${colorScheme} theme`, async ({
    page,
  }) => {
    test.slow();
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });

    await visitMainScreens(page, async (screen) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      expect(
        violations.map(({ id, impact, nodes }) => ({
          screen,
          id,
          impact,
          nodes: nodes.map((node) => node.target.join(' ')),
        })),
      ).toEqual([]);
    });
  });
}

// 768 and 1024 are where the layouts switch, the widths most likely to squeeze something.
for (const width of [360, 768, 1024, 1440]) {
  test(`main screens fit a ${width}px wide window without sideways scrolling`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 800 });

    await visitMainScreens(page, async (screen) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen} overflows sideways`).toBeLessThanOrEqual(0);
    });
  });
}

test('theme follows the system and can be switched by hand', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Usar tema claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Usar tema escuro' })).toBeVisible();
});
