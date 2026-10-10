import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../store-api';
import type { Order, OrderSummary } from '../types';
import { createGatewayApi, type AccessTokens } from './gateway-api';

const GATEWAY = 'http://gateway.test';
const KEYBOARD = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '7c1f0a34-5b1d-4f6e-8a2b-9d3e4f5a6b7c';

// Bodies copied from the contract of the system, field by field.
const product = {
  id: KEYBOARD,
  name: 'Teclado Mecânico',
  description: 'Switches táteis, layout ABNT2',
  price: 349.9,
  availableQuantity: 50,
};

const pendingOrder: Order = {
  id: ORDER_ID,
  customerId: 'c-1001',
  customerName: 'Ana Souza',
  customerEmail: 'ana@exemplo.com',
  status: 'PENDING',
  totalAmount: null,
  cancellationReason: null,
  cancellationDetail: null,
  items: [{ productId: KEYBOARD, productName: null, quantity: 2, unitPrice: null }],
  history: [
    { status: 'PENDING', occurredAt: '2026-10-10T14:03:22.123Z', detail: 'Pedido recebido' },
  ],
  createdAt: '2026-10-10T14:03:22.123Z',
  updatedAt: '2026-10-10T14:03:22.123Z',
};

const confirmedSummary: OrderSummary = {
  id: ORDER_ID,
  customerId: 'c-1001',
  customerName: 'Ana Souza',
  status: 'CONFIRMED',
  totalAmount: 699.8,
  itemCount: 1,
  createdAt: '2026-10-10T14:03:22.123Z',
  updatedAt: '2026-10-10T14:03:26.512Z',
};

const pageOf = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length === 0 ? 0 : 1,
});

const problem = (status: number, title: string, detail: string, extra: object = {}) =>
  HttpResponse.json(
    { type: 'about:blank', title, status, detail, instance: '/api/orders', ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

function signedInWith(token: string | null, renewed: string | null = null) {
  return {
    accessToken: vi.fn<AccessTokens['accessToken']>().mockResolvedValue(token),
    renewAccessToken: vi.fn<AccessTokens['renewAccessToken']>().mockResolvedValue(renewed),
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('requests', () => {
  it('sendsTheBearerTokenAndReadsTheCatalog', async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${GATEWAY}/api/products`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json([product]);
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    await expect(api.listProducts()).resolves.toEqual([product]);
    expect(authorization).toBe('Bearer token-1');
  });

  it('readsTheCatalogWithoutATokenWhenNobodyIsSignedIn', async () => {
    let authorization: string | null = 'unset';
    server.use(
      http.get(`${GATEWAY}/api/products`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json([product]);
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith(null));

    await api.listProducts();

    expect(authorization).toBeNull();
  });

  it('postsTheOrderAsJsonAndReadsThe202', async () => {
    let received: unknown;
    let contentType: string | null = null;
    server.use(
      http.post(`${GATEWAY}/api/orders`, async ({ request }) => {
        received = await request.json();
        contentType = request.headers.get('Content-Type');
        return HttpResponse.json(pendingOrder, {
          status: 202,
          headers: { Location: `/orders/${ORDER_ID}` },
        });
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));
    const order = {
      customerId: 'c-1001',
      customerName: 'Ana Souza',
      customerEmail: 'ana@exemplo.com',
      items: [{ productId: KEYBOARD, quantity: 2 }],
    };

    await expect(api.placeOrder(order)).resolves.toEqual(pendingOrder);
    expect(received).toEqual(order);
    expect(contentType).toBe('application/json');
  });

  it('listsOrdersSendingOnlyTheFiltersThatWereSet', async () => {
    const searches: string[] = [];
    server.use(
      http.get(`${GATEWAY}/api/orders`, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([confirmedSummary]));
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    const page = await api.listOrders({
      status: 'CONFIRMED',
      customerId: 'c-1001',
      page: 0,
      size: 10,
    });
    await api.listOrders({ page: 2 });

    expect(page.content).toEqual([confirmedSummary]);
    expect(searches).toEqual(['?status=CONFIRMED&customerId=c-1001&page=0&size=10', '?page=2']);
  });

  it('setsTheStockOfAProductWithPut', async () => {
    let received: unknown;
    server.use(
      http.put(`${GATEWAY}/api/products/${KEYBOARD}/stock`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...product, availableQuantity: 5 });
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('admin-token'));

    await expect(api.setStock(KEYBOARD, 5)).resolves.toMatchObject({ availableQuantity: 5 });
    expect(received).toEqual({ availableQuantity: 5 });
  });

  it('answersNullWhileTheOrderHasNoPayment', async () => {
    server.use(
      http.get(`${GATEWAY}/api/payments/${ORDER_ID}`, () =>
        problem(404, 'Not Found', `Pagamento do pedido ${ORDER_ID} não encontrado`),
      ),
    );
    const tokens = signedInWith('token-1');
    const api = createGatewayApi(GATEWAY, tokens);

    await expect(api.getPayment(ORDER_ID)).resolves.toBeNull();
    expect(tokens.renewAccessToken).not.toHaveBeenCalled();
  });

  it('readsThePaymentOfAnOrder', async () => {
    const payment = {
      id: 'a3c1f2d4-0000-4000-8000-000000000001',
      orderId: ORDER_ID,
      amount: 699.8,
      status: 'APPROVED',
      reason: null,
      createdAt: '2026-10-10T14:03:25.000Z',
    };
    server.use(http.get(`${GATEWAY}/api/payments/${ORDER_ID}`, () => HttpResponse.json(payment)));
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    await expect(api.getPayment(ORDER_ID)).resolves.toEqual(payment);
  });

  it('asksForTheNotificationsOfOneOrder', async () => {
    let search = '';
    server.use(
      http.get(`${GATEWAY}/api/notifications`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(pageOf([]));
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    await api.listNotifications({ orderId: ORDER_ID, size: 50 });

    expect(search).toBe(`?orderId=${ORDER_ID}&size=50`);
  });

  it('asksAnalyticsWithTheParametersOfTheContract', async () => {
    const asked: string[] = [];
    const record = (body: unknown) => (info: { request: Request }) => {
      const url = new URL(info.request.url);
      asked.push(url.pathname + url.search);
      return HttpResponse.json(body as object);
    };
    const summary = {
      totalOrders: 61,
      confirmed: 54,
      cancelled: 7,
      inProgress: 0,
      confirmedRevenue: 52616.9,
      approvalRate: 0.885,
      averageSecondsToConfirm: 4.3,
      lastEventAt: '2026-10-10T14:03:26.512Z',
    };
    server.use(
      http.get(`${GATEWAY}/api/analytics/summary`, record(summary)),
      http.get(`${GATEWAY}/api/analytics/orders-by-status`, record([])),
      http.get(`${GATEWAY}/api/analytics/revenue`, record([])),
      http.get(`${GATEWAY}/api/analytics/cancellations`, record([])),
      http.get(`${GATEWAY}/api/analytics/top-products`, record([])),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('admin-token'));

    await expect(api.getSummary()).resolves.toEqual(summary);
    await api.getOrdersByStatus();
    await api.getRevenue({ from: '2026-09-27', to: '2026-10-10', granularity: 'day' });
    await api.getCancellations();
    await api.getTopProducts(5);

    expect(asked).toEqual([
      '/api/analytics/summary',
      '/api/analytics/orders-by-status',
      '/api/analytics/revenue?from=2026-09-27&to=2026-10-10&granularity=day',
      '/api/analytics/cancellations',
      '/api/analytics/top-products?limit=5',
    ]);
  });
});

describe('errors', () => {
  it('renewsTheTokenOnceAfterA401AndSendsTheRequestAgain', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${GATEWAY}/api/orders/${ORDER_ID}`, ({ request }) => {
        const authorization = request.headers.get('Authorization');
        seen.push(authorization);
        return authorization === 'Bearer fresh'
          ? HttpResponse.json(pendingOrder)
          : problem(401, 'Unauthorized', 'Token expirado');
      }),
    );
    const tokens = signedInWith('stale', 'fresh');
    const api = createGatewayApi(GATEWAY, tokens);

    await expect(api.getOrder(ORDER_ID)).resolves.toEqual(pendingOrder);
    expect(seen).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(tokens.renewAccessToken).toHaveBeenCalledTimes(1);
  });

  it('raises401WhenTheSessionCannotBeRenewed', async () => {
    let calls = 0;
    server.use(
      http.get(`${GATEWAY}/api/orders`, () => {
        calls += 1;
        return problem(401, 'Unauthorized', 'Token expirado');
      }),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('stale', null));

    await expect(api.listOrders({})).rejects.toMatchObject({ name: 'ApiError', status: 401 });
    expect(calls).toBe(1);
  });

  it('raises401WhenEvenTheRenewedTokenIsRefused', async () => {
    server.use(
      http.get(`${GATEWAY}/api/orders`, () => problem(401, 'Unauthorized', 'Token inválido')),
    );
    const tokens = signedInWith('stale', 'also-refused');
    const api = createGatewayApi(GATEWAY, tokens);

    await expect(api.listOrders({})).rejects.toMatchObject({ status: 401 });
    expect(tokens.renewAccessToken).toHaveBeenCalledTimes(1);
  });

  it('raises403WithoutTryingToRenew', async () => {
    server.use(
      http.get(`${GATEWAY}/api/analytics/summary`, () =>
        problem(403, 'Forbidden', 'É preciso o papel admin'),
      ),
    );
    const tokens = signedInWith('customer-token', 'fresh');
    const api = createGatewayApi(GATEWAY, tokens);

    await expect(api.getSummary()).rejects.toMatchObject({
      status: 403,
      problem: { title: 'Forbidden', detail: 'É preciso o papel admin' },
    });
    expect(tokens.renewAccessToken).not.toHaveBeenCalled();
  });

  it('carriesTheFieldErrorsOfA400', async () => {
    const errors = [{ field: 'items[0].quantity', message: 'deve ser de 1 a 100' }];
    server.use(
      http.post(`${GATEWAY}/api/orders`, () =>
        problem(400, 'Bad Request', 'Pedido inválido', { errors }),
      ),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    const failure = await api
      .placeOrder({ customerId: 'c-1001', customerName: 'Ana', customerEmail: 'a@b.c', items: [] })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      message: 'Pedido inválido',
      problem: { type: 'about:blank', instance: '/api/orders', errors },
    });
  });

  it.each([
    [429, 'Too Many Requests', 'Limite de requisições atingido'],
    [503, 'Service Unavailable', 'order-service não respondeu'],
  ])('raises%iAsAProblem', async (status, title, detail) => {
    server.use(http.post(`${GATEWAY}/api/orders`, () => problem(status, title, detail)));
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    await expect(
      api.placeOrder({ customerId: 'c', customerName: 'n', customerEmail: 'e@e.e', items: [] }),
    ).rejects.toMatchObject({ status, problem: { title, detail, status } });
  });

  it('stillTellsTheStatusWhenTheBodyIsNotAProblem', async () => {
    server.use(
      http.get(
        `${GATEWAY}/api/products`,
        () =>
          new HttpResponse('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
      ),
    );
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    await expect(api.listProducts()).rejects.toMatchObject({
      status: 502,
      problem: { title: 'Bad Gateway', status: 502 },
    });
  });

  it('letsARequestWithNoAnswerFailAsSomethingElseThanAnApiError', async () => {
    server.use(http.get(`${GATEWAY}/api/products`, () => HttpResponse.error()));
    const api = createGatewayApi(GATEWAY, signedInWith('token-1'));

    const failure = await api.listProducts().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ApiError);
  });
});

describe('order stream', () => {
  const STREAM = `${GATEWAY}/api/orders/stream`;
  const timing = { retryDelays: [10], silenceLimit: 2_000 };
  const encoder = new TextEncoder();
  const eventOf = (order: OrderSummary) =>
    `event: order-updated\ndata: ${JSON.stringify(order)}\n\n`;

  /** A stream the test writes to, like the server holding the connection open. */
  function openStream() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    return {
      response: () => new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } }),
      send: (bytes: Uint8Array) => controller.enqueue(bytes),
      close: () => controller.close(),
    };
  }

  function watching(tokens: AccessTokens, overrides: Partial<typeof timing> = {}) {
    const updates: OrderSummary[] = [];
    const connection: boolean[] = [];
    const stop = createGatewayApi(GATEWAY, tokens, { ...timing, ...overrides }).watchOrders({
      onUpdate: (order) => updates.push(order),
      onConnectionChange: (connected) => connection.push(connected),
    });
    return { updates, connection, stop };
  }

  it('deliversEachOrderUpdateSentByTheServer', async () => {
    const stream = openStream();
    let headers = new Headers();
    server.use(
      http.get(STREAM, ({ request }) => {
        headers = request.headers;
        return stream.response();
      }),
    );
    const { updates, connection, stop } = watching(signedInWith('token-1'));
    await vi.waitFor(() => expect(connection).toEqual([true]));

    const reserved: OrderSummary = { ...confirmedSummary, status: 'STOCK_RESERVED' };
    const fabio: OrderSummary = { ...confirmedSummary, customerName: 'Fábio Nunes' };
    stream.send(encoder.encode(`: keep-alive\n\n${eventOf(reserved)}`));
    // Cut in the middle of the two bytes of "á", as the network is free to do.
    const bytes = encoder.encode(eventOf(fabio));
    const cut = bytes.indexOf(0xc3) + 1;
    stream.send(bytes.slice(0, cut));
    stream.send(bytes.slice(cut));
    stream.send(encoder.encode('event: something-new\ndata: {"ignored":true}\n\n'));

    await vi.waitFor(() => expect(updates).toEqual([reserved, fabio]));
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Accept')).toBe('text/event-stream');
    stop();
  });

  it('tellsWhenTheStreamDropsAndConnectsAgain', async () => {
    const first = openStream();
    const second = openStream();
    const streams = [first, second];
    server.use(http.get(STREAM, () => streams.shift()?.response() ?? HttpResponse.error()));
    const { updates, connection, stop } = watching(signedInWith('token-1'));
    await vi.waitFor(() => expect(connection).toEqual([true]));

    first.close();
    await vi.waitFor(() => expect(connection).toEqual([true, false, true]));
    second.send(encoder.encode(eventOf(confirmedSummary)));

    await vi.waitFor(() => expect(updates).toEqual([confirmedSummary]));
    stop();
  });

  it('keepsTryingWhileTheGatewayAnswers503', async () => {
    let attempts = 0;
    const stream = openStream();
    server.use(
      http.get(STREAM, () => {
        attempts += 1;
        return attempts < 3
          ? problem(503, 'Service Unavailable', 'order-service não respondeu')
          : stream.response();
      }),
    );
    const { connection, stop } = watching(signedInWith('token-1'));

    await vi.waitFor(() => expect(connection).toEqual([false, false, true]));
    expect(attempts).toBe(3);
    stop();
  });

  it('treatsALongSilenceAsADroppedConnection', async () => {
    let attempts = 0;
    server.use(
      http.get(STREAM, () => {
        attempts += 1;
        return openStream().response();
      }),
    );
    const { connection, stop } = watching(signedInWith('token-1'), { silenceLimit: 40 });

    await vi.waitFor(() => expect(connection.slice(0, 3)).toEqual([true, false, true]));
    expect(attempts).toBeGreaterThanOrEqual(2);
    stop();
  });

  it('renewsTheTokenWhenTheStreamAnswers401', async () => {
    const stream = openStream();
    const seen: (string | null)[] = [];
    server.use(
      http.get(STREAM, ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return seen.length === 1
          ? problem(401, 'Unauthorized', 'Token expirado')
          : stream.response();
      }),
    );
    const { connection, stop } = watching(signedInWith('stale', 'fresh'));

    await vi.waitFor(() => expect(connection).toEqual([true]));
    expect(seen).toEqual(['Bearer stale', 'Bearer fresh']);
    stop();
  });

  it('givesUpWhenTheSessionIsOverInsteadOfHammeringTheGateway', async () => {
    let attempts = 0;
    server.use(
      http.get(STREAM, () => {
        attempts += 1;
        return problem(401, 'Unauthorized', 'Token expirado');
      }),
    );
    const { connection, stop } = watching(signedInWith('stale', null));

    await vi.waitFor(() => expect(connection).toEqual([false]));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(attempts).toBe(1);
    stop();
  });

  it('stopsListeningWhenTheWatcherLeaves', async () => {
    const stream = openStream();
    let attempts = 0;
    server.use(
      http.get(STREAM, () => {
        attempts += 1;
        return stream.response();
      }),
    );
    const { connection, stop } = watching(signedInWith('token-1'));
    await vi.waitFor(() => expect(connection).toEqual([true]));

    stop();
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Neither reported as a drop nor reconnected.
    expect(connection).toEqual([true]);
    expect(attempts).toBe(1);
  });
});
