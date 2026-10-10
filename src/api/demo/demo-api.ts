import { isAdmin, type Session } from '../../auth/session';
import { ApiError, type ProblemDetails, type StoreApi } from '../store-api';
import type { NewOrder } from '../types';
import * as analytics from './analytics';
import { listOrders } from './orders';
import type { Simulation } from './simulation';

type Access = 'anyone' | 'signed-in' | 'admin';

const problem = (
  status: number,
  title: string,
  detail: string,
  errors?: ProblemDetails['errors'],
) => new ApiError({ type: 'about:blank', title, status, detail, errors });

/**
 * Answers the screens from the simulation, with the rules of the api-gateway in
 * front: who may call what, the rate limit on new orders and a bit of network delay.
 */
export function createDemoApi(
  simulation: Simulation,
  session: Session,
  latency: readonly [min: number, max: number] = [120, 320],
): StoreApi {
  const allowOrder = rateLimiter(2, 5);

  async function respond<T>(access: Access, answer: () => T): Promise<T> {
    const [min, max] = latency;
    if (max > 0) {
      await new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
    }
    const user = session.getUser();
    if (access !== 'anyone' && !user) {
      throw problem(401, 'Unauthorized', 'É preciso entrar para continuar.');
    }
    if (access === 'admin' && !isAdmin(user)) {
      throw problem(403, 'Forbidden', 'Só o papel admin tem acesso a este recurso.');
    }
    // The tables are mutated in place as events arrive; callers get their own copy.
    return structuredClone(answer());
  }

  const tables = () => simulation.tables;

  return {
    listProducts: () => respond('anyone', () => tables().products),

    setStock: (productId, availableQuantity) =>
      respond('admin', () => {
        if (!Number.isInteger(availableQuantity) || availableQuantity < 0) {
          throw problem(400, 'Bad Request', 'Saldo inválido.', [
            {
              field: 'availableQuantity',
              message: 'deve ser um número inteiro maior ou igual a 0',
            },
          ]);
        }
        const product = simulation.setStock(productId, availableQuantity);
        if (!product) throw problem(404, 'Not Found', `Produto ${productId} não encontrado.`);
        return product;
      }),

    placeOrder: (order) =>
      respond('signed-in', () => {
        if (!allowOrder(session.getUser()?.id ?? '')) {
          throw problem(429, 'Too Many Requests', 'Limite de pedidos por segundo atingido.');
        }
        const errors = validate(order);
        if (errors.length > 0) throw problem(400, 'Bad Request', 'Pedido inválido.', errors);
        return simulation.placeOrder(order);
      }),

    getOrder: (id) =>
      respond('signed-in', () => {
        const order = tables().orders[id];
        if (!order) throw problem(404, 'Not Found', `Pedido ${id} não encontrado.`);
        return order;
      }),

    listOrders: (query) => respond('signed-in', () => listOrders(tables(), query)),

    watchOrders(watcher) {
      watcher.onConnectionChange?.(true);
      return simulation.watchOrders((order) => watcher.onUpdate(order));
    },

    getPayment: (orderId) => respond('signed-in', () => tables().payments[orderId] ?? null),

    listNotifications: ({ orderId, size = 20 }) =>
      respond('signed-in', () => {
        const matching = tables().notifications.filter((n) => n.orderId === orderId);
        return {
          content: matching.slice(0, size),
          page: 0,
          size,
          totalElements: matching.length,
          totalPages: Math.ceil(matching.length / size),
        };
      }),

    getSummary: () => respond('admin', () => analytics.summary(tables().analytics)),
    getOrdersByStatus: () => respond('admin', () => analytics.ordersByStatus(tables().analytics)),
    getRevenue: (query) => respond('admin', () => analytics.revenue(tables().analytics, query)),
    getCancellations: () => respond('admin', () => analytics.cancellations(tables().analytics)),
    getTopProducts: (limit) =>
      respond('admin', () => analytics.topProducts(tables().analytics, limit)),
  };
}

/** The rules of POST /orders. */
function validate(order: NewOrder): NonNullable<ProblemDetails['errors']> {
  const errors: NonNullable<ProblemDetails['errors']> = [];
  if (!order.customerId.trim()) errors.push({ field: 'customerId', message: 'é obrigatório' });
  if (!order.customerName.trim()) errors.push({ field: 'customerName', message: 'é obrigatório' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customerEmail)) {
    errors.push({ field: 'customerEmail', message: 'deve ser um e-mail válido' });
  }
  if (order.items.length < 1 || order.items.length > 20) {
    errors.push({ field: 'items', message: 'deve ter de 1 a 20 itens' });
  }
  if (new Set(order.items.map((item) => item.productId)).size !== order.items.length) {
    errors.push({ field: 'items', message: 'não pode repetir o mesmo produto' });
  }
  order.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      errors.push({ field: `items[${index}].quantity`, message: 'deve ser de 1 a 100' });
    }
  });
  return errors;
}

/** Token bucket per caller, like the one the gateway keeps in Redis. */
function rateLimiter(perSecond: number, burst: number) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: burst, at: now };
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
    bucket.at = now;
    buckets.set(key, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };
}
