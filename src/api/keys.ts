import type { OrderQuery } from './types';

/** Everything about orders sits under `orders`, so one stream event refreshes it all. */
export const keys = {
  products: ['products'] as const,
  orders: ['orders'] as const,
  orderList: (query: OrderQuery) => ['orders', 'list', query] as const,
  order: (id: string) => ['orders', id] as const,
  payment: (id: string) => ['orders', id, 'payment'] as const,
  notifications: (id: string) => ['orders', id, 'notifications'] as const,
  indicators: ['indicators'] as const,
};
