import { expect, orderList, placeOrder, test, viewAs } from './fixtures';

test('keyboard order shows up as received and confirms by itself', async ({ page }) => {
  const row = await placeOrder(page, 'Teclado Mecânico');
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));

  await expect(row.getByText('Recebido')).toBeVisible();
  await expect(row.getByText('Estoque reservado')).toBeVisible();
  await expect(row.getByText('Confirmado')).toBeVisible();
  await expect(row).toContainText('R$ 349,90');
  // A reload would have wiped the mark: only the stream moved the row.
  expect(await page.evaluate(() => 'sameDocument' in window)).toBe(true);
});

test('headset order is cancelled for lack of stock', async ({ page }) => {
  const row = await placeOrder(page, 'Headset USB');

  await expect(row.getByText('Cancelado')).toBeVisible();

  await row.getByRole('link').click();
  await expect(page.getByText('Motivo: sem estoque')).toBeVisible();
  await expect(page.getByText('Headset USB: pedido 1, disponível 0')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pagamento' })).toContainText('Não houve cobrança');
});

test('notebook order is cancelled because the payment is refused', async ({ page }) => {
  const row = await placeOrder(page, 'Notebook Pro 16');

  await expect(row.getByText('Estoque reservado')).toBeVisible();
  await expect(row.getByText('Cancelado')).toBeVisible();

  await row.getByRole('link').click();
  await expect(page.getByText('Motivo: pagamento recusado')).toBeVisible();
  const payment = page.getByRole('region', { name: 'Pagamento' });
  await expect(payment).toContainText('Recusado');
  await expect(payment).toContainText('Valor acima do limite de aprovação');
  await expect(payment).toContainText('R$ 7.499,00');
});

test('order detail shows the whole timeline, the payment and the notifications', async ({
  page,
}) => {
  const row = await placeOrder(page, 'Teclado Mecânico', 'Mouse Sem Fio');
  await row.getByRole('link').click();

  // Opened while the order is still moving: the timeline fills in on its own.
  const steps = page.getByRole('list', { name: 'Andamento do pedido' }).getByRole('listitem');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('Pedido recebido');
  await expect(steps.nth(1)).toContainText('Estoque reservado');
  await expect(steps.nth(2)).toContainText('Pagamento aprovado');
  await expect(steps.nth(3)).toContainText('Pedido confirmado');

  const items = page.getByRole('region', { name: 'Itens' });
  await expect(items).toContainText('Teclado Mecânico');
  await expect(items).toContainText('Mouse Sem Fio');
  await expect(items).toContainText('R$ 479,80');

  const payment = page.getByRole('region', { name: 'Pagamento' });
  await expect(payment).toContainText('Aprovado');
  await expect(payment).toContainText('R$ 479,80');

  const notifications = page.getByRole('region', { name: 'Notificações' });
  await expect(notifications.getByText('Recebemos o seu pedido')).toHaveCount(2);
  await expect(notifications.getByText('Seu pedido foi confirmado')).toHaveCount(2);
  await expect(notifications.getByText('E-mail para ana@exemplo.com')).toHaveCount(2);
  await expect(notifications.getByText('Enviada')).toHaveCount(4);
});

test('headset order confirms once the admin gives it stock', async ({ page }) => {
  await page.goto('/estoque');
  await viewAs(page, 'Admin');

  await page.getByRole('spinbutton', { name: 'Saldo de Headset USB' }).fill('5');
  await page.getByRole('button', { name: 'Salvar saldo de Headset USB' }).click();
  await expect(page.getByText('Saldo de Headset USB salvo', { exact: true })).toBeVisible();

  const row = await placeOrder(page, 'Headset USB');
  await expect(row.getByText('Confirmado')).toBeVisible();
  await expect(row).toContainText('R$ 279,50');

  await page.goto('/estoque');
  await expect(page.getByRole('spinbutton', { name: 'Saldo de Headset USB' })).toHaveValue('4');
});

test('orders can be filtered by state', async ({ page }) => {
  await page.goto('/pedidos');
  await expect(orderList(page).getByRole('link').first()).toBeVisible();

  await page.getByRole('button', { name: 'Cancelado' }).click();

  await expect(page).toHaveURL(/estado=CANCELLED/);
  await expect
    .poll(async () => {
      const rows = await orderList(page).getByRole('link').allInnerTexts();
      return rows.length > 0 && rows.every((row) => row.includes('Cancelado'));
    })
    .toBe(true);
});
