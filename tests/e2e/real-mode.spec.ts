import type { Page } from '@playwright/test';
import { expect, orderList, test } from './fixtures';
import {
  admin,
  ana,
  mockGateway,
  mockKeycloak,
  pageOf,
  problem,
  useRealMode,
} from './real-backend';

// The same build as the other tests, switched to the real mode by its runtime settings.
// Keycloak and the api-gateway are played at the network, with the bodies of the contract.

const ORDER_ID = '7c1f0a34-5b1d-4f6e-8a2b-9d3e4f5a6b7c';

const summary = (status: 'PENDING' | 'CONFIRMED') => ({
  id: ORDER_ID,
  customerId: ana.sub,
  customerName: 'Ana Souza',
  status,
  totalAmount: status === 'CONFIRMED' ? 699.8 : null,
  itemCount: 1,
  createdAt: '2026-10-10T14:03:22.123Z',
  updatedAt: '2026-10-10T14:03:26.512Z',
});

const keyboard = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Teclado Mecânico',
  description: 'Switches táteis, layout ABNT2',
  price: 349.9,
  availableQuantity: 50,
};

const menu = (page: Page) => page.getByRole('navigation', { name: 'Principal' });

async function signIn(page: Page, address = '/') {
  await page.goto(address);
  await page.getByRole('button', { name: 'Entrar com a conta da loja' }).click();
}

// The browser itself logs every 4xx and 5xx answer as a console error.
test.use({ expectedConsoleErrors: /Failed to load resource/ });

test.beforeEach(({ page }) => useRealMode(page));

test('signs in at Keycloak with PKCE and opens the address that was asked for', async ({
  page,
}) => {
  const keycloak = await mockKeycloak(page);
  const gateway = await mockGateway(page, {
    'GET /api/orders': () => ({ json: pageOf([summary('CONFIRMED')]) }),
  });

  await page.goto('/pedidos');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(gateway.requests).toEqual([]);
  await page.getByRole('button', { name: 'Entrar com a conta da loja' }).click();

  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page).toHaveURL(/\/pedidos$/);
  await expect(page.getByRole('banner')).toContainText('Ana Souza');
  await expect(page.getByRole('banner')).toContainText('Cliente');
  await expect(menu(page).getByRole('link')).toHaveText(['Loja', 'Pedidos']);
  await expect(orderList(page).getByRole('listitem')).toContainText(['Confirmado']);

  const login = keycloak.logins[0];
  expect(Object.fromEntries(login ?? [])).toMatchObject({
    client_id: 'store-web',
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge_method: 'S256',
    redirect_uri: new URL('/', page.url()).href,
  });
  // The mock only hands out tokens when the verifier matches the challenge sent before.
  expect(Object.fromEntries(keycloak.tokenRequests[0] ?? [])).toMatchObject({
    grant_type: 'authorization_code',
    client_id: 'store-web',
    code: 'code-1',
    redirect_uri: new URL('/', page.url()).href,
  });

  const listing = gateway.requests.find((request) => request.call === 'GET /api/orders');
  expect(listing?.authorization).toBe(`Bearer ${keycloak.accessTokens[0]}`);
  expect(listing?.search.get('customerId')).toBe(ana.sub);

  // The session lasts for the tab: a reload does not go through the login again.
  await page.reload();
  await expect(orderList(page).getByRole('listitem')).toContainText(['Confirmado']);
  expect(keycloak.logins).toHaveLength(1);
});

test('admin role in the token opens the admin screens', async ({ page }) => {
  await mockKeycloak(page, admin);
  const gateway = await mockGateway(page, {
    'GET /api/products': () => ({ json: [keyboard] }),
    [`PUT /api/products/${keyboard.id}/stock`]: () => ({
      json: { ...keyboard, availableQuantity: 45 },
    }),
  });

  await signIn(page, '/estoque');

  await expect(page.getByRole('heading', { name: 'Estoque' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Administrador');
  await expect(menu(page).getByRole('link')).toHaveText([
    'Loja',
    'Pedidos',
    'Indicadores',
    'Estoque',
  ]);
  const balance = page.getByRole('spinbutton', { name: 'Saldo de Teclado Mecânico' });
  await expect(balance).toHaveValue('50');

  await balance.fill('45');
  await page.getByRole('button', { name: 'Salvar saldo de Teclado Mecânico' }).click();

  await expect(page.getByText('Saldo de Teclado Mecânico salvo', { exact: true })).toBeVisible();
  expect(gateway.calls(`PUT /api/products/${keyboard.id}/stock`)).toBe(1);
});

test('renews the token when the gateway refuses it and carries on', async ({ page }) => {
  const keycloak = await mockKeycloak(page);
  const gateway = await mockGateway(page, {
    'GET /api/products': async (request) =>
      (await request.headerValue('authorization')) === `Bearer ${keycloak.accessTokens[0]}`
        ? problem(401, 'Unauthorized', 'Jwt expired')
        : { json: [keyboard] },
  });

  await signIn(page);

  await expect(page.getByText('Teclado Mecânico')).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Ana Souza');
  expect(Object.fromEntries(keycloak.tokenRequests[1] ?? [])).toMatchObject({
    grant_type: 'refresh_token',
    refresh_token: 'refresh-1',
    client_id: 'store-web',
  });
  expect(gateway.requests.at(-1)?.authorization).toBe(`Bearer ${keycloak.accessTokens[1]}`);
});

test('goes back to the sign-in screen when the session can no longer be renewed', async ({
  page,
}) => {
  const keycloak = await mockKeycloak(page);
  await mockGateway(page, {
    'GET /api/products': () =>
      keycloak.sessionEnded ? problem(401, 'Unauthorized', 'Jwt expired') : { json: [keyboard] },
    'GET /api/orders': () => problem(401, 'Unauthorized', 'Jwt expired'),
  });
  await signIn(page);
  await expect(page.getByText('Teclado Mecânico')).toBeVisible();

  keycloak.sessionEnded = true;
  await menu(page).getByRole('link', { name: 'Pedidos' }).click();

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  // Signing out also ends the session at Keycloak, naming where to come back to.
  expect(keycloak.logouts).toHaveLength(1);
  expect(keycloak.logouts[0]?.get('post_logout_redirect_uri')).toBe(new URL('/', page.url()).href);
  expect(keycloak.logouts[0]?.get('id_token_hint')).toBeTruthy();
});

test('follows the order stream and falls back to polling when it drops', async ({ page }) => {
  await mockKeycloak(page);
  let streamOpened = 0;
  let confirmed = false;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const gateway = await mockGateway(page, {
    'GET /api/orders': () => ({ json: pageOf([summary(confirmed ? 'CONFIRMED' : 'PENDING')]) }),
    'GET /api/orders/stream': async () => {
      streamOpened += 1;
      if (streamOpened > 1) return problem(503, 'Service Unavailable', 'order-service is down');
      await held;
      confirmed = true;
      return {
        eventStream: `: keep-alive\n\nevent: order-updated\ndata: ${JSON.stringify(summary('CONFIRMED'))}\n\n`,
      };
    },
  });

  await signIn(page, '/pedidos');
  const row = orderList(page).getByRole('listitem').first();
  await expect(row).toContainText('Recebido');
  await expect(page.getByText('Ao vivo: o estado muda sozinho')).toBeVisible();
  const stream = gateway.requests.find((request) => request.call === 'GET /api/orders/stream');
  expect(stream?.authorization).toMatch(/^Bearer /);

  release();

  // The event made the list be fetched again; nothing was reloaded.
  await expect(row).toContainText('Confirmado');
  await expect(page.getByText('Sem conexão ao vivo, atualizando a cada 5 s')).toBeVisible();
  const before = gateway.calls('GET /api/orders');
  await expect
    .poll(() => gateway.calls('GET /api/orders'), { timeout: 12_000 })
    .toBeGreaterThan(before);
});

test('says so when the login server does not answer', async ({ page }) => {
  await page.route('http://localhost:8180/**', (route) => route.abort('connectionrefused'));

  await signIn(page);

  await expect(page.getByRole('alert')).toContainText('O login não respondeu');
  await expect(page.getByRole('button', { name: 'Entrar com a conta da loja' })).toBeEnabled();
});
