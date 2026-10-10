import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { StoreApi } from './api/store-api';
import type { Order } from './api/types';
import {
  admin,
  confirmedOrder,
  failure,
  headset,
  keyboard,
  pageOf,
  renderApp,
  sessionOf,
  stubApi,
  summaryOf,
} from './test/app';

// The app loads this screen on demand. Loading it up front keeps a slow first import
// (it brings the chart library) from eating into the time a test waits for the screen.
beforeAll(() => import('./indicators/IndicatorsPage'));

/** Fails on the first call and answers on the following ones, like a service coming back. */
function failingOnce<T>(status: number, answer: T) {
  return vi
    .fn<() => Promise<T>>()
    .mockRejectedValueOnce(failure(status))
    .mockImplementation(() => Promise.resolve(answer));
}

describe('error state, one per screen', () => {
  it('shopOffersRetryWhenCatalogFails', async () => {
    renderApp({ api: stubApi({ listProducts: failingOnce(503, [keyboard]) }) });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serviço fora do ar');
    expect(alert).not.toHaveTextContent('detalhe técnico');

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Teclado Mecânico')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ordersExplainTheRateLimit', async () => {
    const listOrders = failingOnce(429, pageOf([summaryOf(confirmedOrder)]));
    renderApp({ api: stubApi({ listOrders }), route: '/pedidos' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Muitas requisições em pouco tempo');

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('#7C1F0A34')).toBeInTheDocument();
  });

  it('orderDetailOffersRetryWhenTheOrderFailsToLoad', async () => {
    const getOrder = failingOnce(503, confirmedOrder);
    renderApp({ api: stubApi({ getOrder }), route: `/pedidos/${confirmedOrder.id}` });

    const alert = await screen.findByRole('alert');
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('list', { name: 'Andamento do pedido' })).toBeInTheDocument();
  });

  it('orderDetailSaysWhenTheOrderDoesNotExist', async () => {
    renderApp({ route: '/pedidos/nao-existe' });

    expect(await screen.findByText('Pedido não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver os pedidos' })).toHaveAttribute(
      'href',
      '/pedidos',
    );
  });

  it('orderDetailKeepsTheOrderOnScreenWhenOnlyNotificationsFail', async () => {
    const api = stubApi({
      getOrder: () => Promise.resolve(confirmedOrder),
      listNotifications: () => Promise.reject(failure(503)),
    });
    renderApp({ api, route: `/pedidos/${confirmedOrder.id}` });

    const notifications = await screen.findByRole('region', { name: 'Notificações' });
    expect(await within(notifications).findByRole('alert')).toHaveTextContent('Serviço fora do ar');
    expect(screen.getByText('Pedido confirmado')).toBeInTheDocument();
  });

  it('indicatorsOfferRetryWhenAnalyticsIsDown', async () => {
    const getSummary = vi.fn<StoreApi['getSummary']>().mockRejectedValue(failure(503));
    renderApp({ api: stubApi({ getSummary }), user: admin, route: '/indicadores' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serviço fora do ar');
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
  });

  it('stockOffersRetryWhenProductsFail', async () => {
    const api = stubApi({ listProducts: failingOnce(503, [headset]) });
    renderApp({ api, user: admin, route: '/estoque' });

    const alert = await screen.findByRole('alert');
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByLabelText('Saldo de Headset USB')).toHaveValue(0);
  });

  it('sendsToSignInWhenTheSessionIsRejected', async () => {
    renderApp({
      api: stubApi({ listOrders: () => Promise.reject(failure(401)) }),
      route: '/pedidos',
    });

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});

describe('loading and empty states', () => {
  it('showsPlaceholdersWhileOrdersLoad', () => {
    renderApp({ api: stubApi({ listOrders: () => new Promise(() => {}) }), route: '/pedidos' });

    expect(screen.getByRole('status', { name: 'Carregando os pedidos' })).toBeInTheDocument();
  });

  it('invitesToTheShopWhenThereAreNoOrders', async () => {
    renderApp({ route: '/pedidos' });

    expect(await screen.findByText('Nenhum pedido ainda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para a loja' })).toHaveAttribute('href', '/');
  });

  it('offersToClearTheFilterWhenNoOrderMatchesIt', async () => {
    renderApp({ route: '/pedidos?estado=CANCELLED' });

    expect(await screen.findByText('Nenhum pedido com o estado “Cancelado”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver todos os pedidos' })).toBeInTheDocument();
  });

  it('saysWhenTheCatalogIsEmpty', async () => {
    renderApp();

    expect(await screen.findByText('Nenhum produto no catálogo')).toBeInTheDocument();
  });

  it('saysWhenThereIsNothingToSummarize', async () => {
    renderApp({ user: admin, route: '/indicadores' });

    expect(await screen.findByText('Ainda não há pedidos para resumir')).toBeInTheDocument();
  });
});

describe('access by role', () => {
  it('hidesAdminScreensFromTheCustomerMenu', async () => {
    renderApp();

    const menu = await screen.findByRole('navigation', { name: 'Principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Loja', 'Pedidos']);
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('showsNoAccessWhenACustomerOpensAnAdminAddress', async () => {
    const getSummary = vi.fn<StoreApi['getSummary']>();
    renderApp({ api: stubApi({ getSummary }), route: '/indicadores' });

    expect(await screen.findByRole('heading', { name: 'Sem acesso' })).toBeInTheDocument();
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('showsAdminScreensToTheAdmin', async () => {
    renderApp({ user: admin, route: '/estoque' });

    const menu = await screen.findByRole('navigation', { name: 'Principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Loja', 'Pedidos', 'Indicadores', 'Estoque']);
    expect(screen.getByRole('heading', { name: 'Estoque' })).toBeInTheDocument();
  });

  it('asksOnlyForTheCustomersOwnOrders', async () => {
    const listOrders = vi.fn<StoreApi['listOrders']>().mockResolvedValue(pageOf([]));
    renderApp({ api: stubApi({ listOrders }), route: '/pedidos' });

    await waitFor(() =>
      expect(listOrders).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c-1001' })),
    );
  });
});

describe('signing in with the store account', () => {
  it('asksTheSessionToComeBackToTheAddressThatWasOpened', async () => {
    const session = sessionOf(null);
    const signIn = vi.spyOn(session, 'signIn');
    renderApp({ session, user: null, route: '/estoque' });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Entrar com a conta da loja' }),
    );

    expect(signIn).toHaveBeenCalledWith('/estoque');
  });

  it('saysWhenTheLoginPageCannotBeOpened', async () => {
    const session = sessionOf(null);
    vi.spyOn(session, 'signIn').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp({ session, user: null });

    const enter = await screen.findByRole('button', { name: 'Entrar com a conta da loja' });
    await userEvent.click(enter);

    expect(await screen.findByRole('alert')).toHaveTextContent('O login não respondeu');
    expect(enter).toBeEnabled();
  });
});

describe('placing an order', () => {
  it('sendsTheCartInTheContractShapeAndGoesToTheOrders', async () => {
    const pending: Order = {
      ...confirmedOrder,
      status: 'PENDING',
      totalAmount: null,
      history: confirmedOrder.history.slice(0, 1),
    };
    const placeOrder = vi.fn<StoreApi['placeOrder']>().mockResolvedValue(pending);
    const api = stubApi({
      listProducts: () => Promise.resolve([keyboard, headset]),
      placeOrder,
      listOrders: () => Promise.resolve(pageOf([summaryOf(pending)])),
    });
    renderApp({ api });

    const add = await screen.findByRole('button', { name: 'Aumentar Teclado Mecânico' });
    await userEvent.click(add);
    await userEvent.click(add);
    const slip = screen.getByRole('region', { name: 'Seu pedido' });
    expect(within(slip).getByText(/R\$\s699,80/, { selector: 'strong' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Finalizar pedido' }));

    expect(placeOrder).toHaveBeenCalledWith({
      customerId: 'c-1001',
      customerName: 'Ana Souza',
      customerEmail: 'ana@exemplo.com',
      items: [{ productId: keyboard.id, quantity: 2 }],
    });
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(await screen.findByText('Recebido', { selector: 'li span' })).toBeInTheDocument();
  });

  it('marksAProductWithoutStockButStillLetsItBeOrdered', async () => {
    renderApp({ api: stubApi({ listProducts: () => Promise.resolve([headset]) }) });

    expect(await screen.findByText('Sem saldo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aumentar Headset USB' })).toBeEnabled();
  });

  it('keepsTheCartAndExplainsWhenTheOrderIsRateLimited', async () => {
    const api = stubApi({
      listProducts: () => Promise.resolve([keyboard]),
      placeOrder: () => Promise.reject(failure(429)),
    });
    renderApp({ api });

    await userEvent.click(await screen.findByRole('button', { name: 'Aumentar Teclado Mecânico' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar pedido' }));

    const slip = screen.getByRole('region', { name: 'Seu pedido' });
    expect(await within(slip).findByRole('alert')).toHaveTextContent(
      'Muitas requisições em pouco tempo',
    );
    expect(within(slip).getByText(/Teclado Mecânico/)).toBeInTheDocument();
  });
});

describe('live orders', () => {
  it('refetchesAndAnnouncesWhenTheStreamReportsAChange', async () => {
    const pending: Order = { ...confirmedOrder, status: 'PENDING', totalAmount: null };
    const listOrders = vi
      .fn<StoreApi['listOrders']>()
      .mockResolvedValueOnce(pageOf([summaryOf(pending)]))
      .mockResolvedValue(pageOf([summaryOf(confirmedOrder)]));
    const api = stubApi({ listOrders });
    renderApp({ api, route: '/pedidos' });
    const list = await screen.findByRole('region', { name: 'Lista de pedidos' });
    expect(await within(list).findByText('Recebido')).toBeInTheDocument();

    act(() => api.stream.onUpdate(summaryOf(confirmedOrder)));

    expect(await within(list).findByText('Confirmado')).toBeInTheDocument();
    expect(within(list).queryByText('Recebido')).not.toBeInTheDocument();
    expect(screen.getByText('Pedido #7C1F0A34: Confirmado')).toHaveAttribute('aria-live', 'polite');
  });

  it('saysItIsPollingWhenTheStreamGoesDown', async () => {
    const api = stubApi();
    renderApp({ api, route: '/pedidos' });
    expect(await screen.findByText('Ao vivo: o estado muda sozinho')).toBeInTheDocument();

    act(() => api.stream.onConnectionChange?.(false));

    expect(screen.getByText('Sem conexão ao vivo, atualizando a cada 5 s')).toBeInTheDocument();
  });
});

describe('order detail', () => {
  it('showsTimelinePaymentAndNotifications', async () => {
    const api = stubApi({
      getOrder: () => Promise.resolve(confirmedOrder),
      getPayment: () =>
        Promise.resolve({
          id: 'p-1',
          orderId: confirmedOrder.id,
          amount: 699.8,
          status: 'APPROVED',
          reason: null,
          createdAt: '2026-10-10T14:03:25.000Z',
        }),
      listNotifications: () =>
        Promise.resolve(
          pageOf([
            {
              id: 'n-1',
              userId: 'c-1001',
              orderId: confirmedOrder.id,
              channel: 'EMAIL',
              template: 'ORDER_CONFIRMED',
              recipient: {
                name: 'Ana Souza',
                email: 'ana@exemplo.com',
                phone: null,
                deviceToken: null,
              },
              subject: 'Seu pedido foi confirmado',
              status: 'SENT',
              attempts: [{ number: 1, at: '2026-10-10T14:03:27.000Z', success: true, error: null }],
              scheduledAt: null,
              sentAt: '2026-10-10T14:03:27.000Z',
              createdAt: '2026-10-10T14:03:26.000Z',
            },
          ]),
        ),
    });
    renderApp({ api, route: `/pedidos/${confirmedOrder.id}` });

    const timeline = await screen.findByRole('list', { name: 'Andamento do pedido' });
    await waitFor(() =>
      expect(
        within(timeline)
          .getAllByRole('listitem')
          .map((step) => step.textContent),
      ).toEqual([
        expect.stringContaining('Pedido recebido'),
        expect.stringContaining('Estoque reservado'),
        expect.stringContaining('Pagamento aprovado'),
        expect.stringContaining('Pedido confirmado'),
      ]),
    );

    const payment = screen.getByRole('region', { name: 'Pagamento' });
    expect(await within(payment).findByText('Aprovado')).toBeInTheDocument();

    const notifications = screen.getByRole('region', { name: 'Notificações' });
    expect(await within(notifications).findByText('Seu pedido foi confirmado')).toBeInTheDocument();
    expect(within(notifications).getByText('E-mail para ana@exemplo.com')).toBeInTheDocument();
    expect(within(notifications).getByText('Enviada')).toBeInTheDocument();
  });
});

describe('stock', () => {
  it('savesTheNewQuantityOfAProduct', async () => {
    const setStock = vi
      .fn<StoreApi['setStock']>()
      .mockResolvedValue({ ...headset, availableQuantity: 5 });
    const api = stubApi({ listProducts: () => Promise.resolve([headset]), setStock });
    renderApp({ api, user: admin, route: '/estoque' });

    const field = await screen.findByLabelText('Saldo de Headset USB');
    const save = screen.getByRole('button', { name: 'Salvar saldo de Headset USB' });
    expect(save).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, '5');
    await userEvent.click(save);

    expect(setStock).toHaveBeenCalledWith(headset.id, 5);
    expect(await screen.findByText('Saldo de Headset USB salvo')).toBeInTheDocument();
  });

  it('refusesANegativeQuantity', async () => {
    const api = stubApi({ listProducts: () => Promise.resolve([headset]) });
    renderApp({ api, user: admin, route: '/estoque' });

    const field = await screen.findByLabelText('Saldo de Headset USB');
    await userEvent.clear(field);
    await userEvent.type(field, '-3');

    expect(field).toBeInvalid();
    expect(screen.getByRole('button', { name: 'Salvar saldo de Headset USB' })).toBeDisabled();
  });
});
