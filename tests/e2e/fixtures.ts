import { expect, test as base, type Locator, type Page } from '@playwright/test';

/** Every test also fails if the page logs an error or throws, whatever it was checking. */
export const test = base.extend<{
  /** Console errors a test provokes on purpose, like the browser reporting a 401. */
  expectedConsoleErrors: RegExp | undefined;
  failOnConsoleErrors: void;
}>({
  expectedConsoleErrors: [undefined, { option: true }],
  failOnConsoleErrors: [
    async ({ page, expectedConsoleErrors }, use) => {
      const errors: string[] = [];
      const record = (text: string) => {
        if (!expectedConsoleErrors?.test(text)) errors.push(text);
      };
      page.on('console', (message) => {
        if (message.type() === 'error') record(message.text());
      });
      page.on('pageerror', (error) => record(error.message));
      await use();
      expect(errors, 'errors in the browser console').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const orderList = (page: Page) => page.getByRole('region', { name: 'Lista de pedidos' });

/** Adds one unit of each product, finishes the order and returns its row in the list. */
export async function placeOrder(page: Page, ...products: string[]): Promise<Locator> {
  await page.goto('/');
  for (const product of products) {
    await page.getByRole('button', { name: `Aumentar ${product}` }).click();
  }
  await page.getByRole('button', { name: 'Finalizar pedido' }).click();

  const toast = page.getByText(/^Pedido #[0-9A-F]{8} recebido$/);
  await expect(toast).toBeVisible();
  const code = /#[0-9A-F]{8}/.exec(await toast.innerText())?.[0] ?? '';

  await expect(page).toHaveURL(/\/pedidos$/);
  return orderList(page).getByRole('listitem').filter({ hasText: code });
}

export async function viewAs(page: Page, persona: 'Admin' | 'Ana (cliente)') {
  await page.getByRole('radiogroup', { name: 'Ver como' }).getByText(persona).click();
  await expect(
    page.getByRole('banner').getByText(persona === 'Admin' ? 'Administrador' : 'Cliente'),
  ).toBeVisible();
}
