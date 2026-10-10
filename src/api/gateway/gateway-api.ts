import { ApiError, type ProblemDetails, type StoreApi } from '../store-api';
import { watchOrderStream, type StreamTiming } from './order-stream';

/** Where the client gets the bearer token from. The OIDC session implements it. */
export interface AccessTokens {
  /** The token to send now, or `null` when nobody is signed in. */
  accessToken(): Promise<string | null>;
  /** Asks the identity provider for a new token. `null` when the session is over. */
  renewAccessToken(): Promise<string | null>;
}

type Query = Record<string, string | number | undefined>;

interface Call {
  query?: Query;
  body?: unknown;
}

/** The screens' backend, answered by the api-gateway at `baseUrl`. */
export function createGatewayApi(
  baseUrl: string,
  tokens: AccessTokens,
  streamTiming?: StreamTiming,
): StoreApi {
  async function call(method: string, path: string, { query, body }: Call = {}) {
    const url = new URL(`${baseUrl}/api${path}`);
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    const send = (token: string | null) =>
      fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let response = await send(await tokens.accessToken());
    if (response.status === 401) {
      // The token may have run out between the check and the request. The gateway
      // refused before passing anything on, so sending again is safe even for a POST.
      const renewed = await tokens.renewAccessToken();
      if (renewed) response = await send(renewed);
    }
    if (!response.ok) throw new ApiError(await problemOf(response));
    return response;
  }

  const get = async <T>(path: string, query?: Query) =>
    (await (await call('GET', path, { query })).json()) as T;

  const send = async <T>(method: 'POST' | 'PUT', path: string, body: unknown) =>
    (await (await call(method, path, { body })).json()) as T;

  return {
    listProducts: () => get('/products'),
    setStock: (productId, availableQuantity) =>
      send('PUT', `/products/${encodeURIComponent(productId)}/stock`, { availableQuantity }),

    placeOrder: (order) => send('POST', '/orders', order),
    getOrder: (id) => get(`/orders/${encodeURIComponent(id)}`),
    listOrders: ({ status, customerId, page, size }) =>
      get('/orders', { status, customerId, page, size }),
    watchOrders: (watcher) =>
      watchOrderStream(`${baseUrl}/api/orders/stream`, tokens, watcher, streamTiming),

    async getPayment(orderId) {
      try {
        return await get(`/payments/${encodeURIComponent(orderId)}`);
      } catch (error) {
        // No payment yet is the normal state of an order that was not charged.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    listNotifications: ({ orderId, size }) => get('/notifications', { orderId, size }),

    getSummary: () => get('/analytics/summary'),
    getOrdersByStatus: () => get('/analytics/orders-by-status'),
    getRevenue: ({ from, to, granularity }) => get('/analytics/revenue', { from, to, granularity }),
    getCancellations: () => get('/analytics/cancellations'),
    getTopProducts: (limit) => get('/analytics/top-products', { limit }),
  };
}

/** The services answer RFC 7807. Whatever sits in front of them (a proxy) may not. */
async function problemOf(response: Response): Promise<ProblemDetails> {
  const fallback = { title: response.statusText || `HTTP ${response.status}` };
  let body: Partial<ProblemDetails> = {};
  if (response.headers.get('Content-Type')?.includes('json')) {
    try {
      body = (await response.json()) as Partial<ProblemDetails>;
    } catch {
      // An empty or broken body: the status alone still tells the screens what to say.
    }
  }
  return { ...fallback, ...body, status: response.status };
}
