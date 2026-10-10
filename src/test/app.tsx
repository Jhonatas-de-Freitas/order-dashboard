import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiError, type OrderWatcher, type StoreApi } from '../api/store-api';
import type { Order, OrderSummary, Page, Product } from '../api/types';
import { AppRoutes, Providers } from '../App';
import type { Session, User } from '../auth/session';

export const ana: User = {
  id: 'c-1001',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  roles: ['customer'],
};

export const admin: User = {
  id: 'c-1000',
  name: 'Admin Loja',
  email: 'admin@exemplo.com',
  roles: ['admin', 'customer'],
};

export const keyboard: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Teclado Mecânico',
  description: 'Switches táteis, layout ABNT2',
  price: 349.9,
  availableQuantity: 50,
};

export const headset: Product = {
  id: '44444444-4444-4444-4444-444444444444',
  name: 'Headset USB',
  description: 'Microfone com cancelamento de ruído',
  price: 279.5,
  availableQuantity: 0,
};

export const confirmedOrder: Order = {
  id: '7c1f0a34-5b1d-4f6e-8a2b-9d3e4f5a6b7c',
  customerId: 'c-1001',
  customerName: 'Ana Souza',
  customerEmail: 'ana@exemplo.com',
  status: 'CONFIRMED',
  totalAmount: 699.8,
  cancellationReason: null,
  cancellationDetail: null,
  items: [
    { productId: keyboard.id, productName: 'Teclado Mecânico', quantity: 2, unitPrice: 349.9 },
  ],
  history: [
    { status: 'PENDING', occurredAt: '2026-10-10T14:03:22.000Z', detail: 'Pedido recebido' },
    {
      status: 'STOCK_RESERVED',
      occurredAt: '2026-10-10T14:03:24.000Z',
      detail: 'Estoque reservado',
    },
    { status: 'CONFIRMED', occurredAt: '2026-10-10T14:03:26.000Z', detail: 'Pagamento aprovado' },
  ],
  createdAt: '2026-10-10T14:03:22.000Z',
  updatedAt: '2026-10-10T14:03:26.000Z',
};

export const summaryOf = (order: Order): OrderSummary => ({
  id: order.id,
  customerId: order.customerId,
  customerName: order.customerName,
  status: order.status,
  totalAmount: order.totalAmount,
  itemCount: order.items.length,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export const pageOf = <T,>(content: T[]): Page<T> => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: content.length === 0 ? 0 : 1,
});

export const failure = (status: number) =>
  new ApiError({ type: 'about:blank', title: 'Error', status, detail: 'detalhe técnico' });

/** A backend with nothing in it. Each test overrides the calls it cares about. */
export function stubApi(overrides: Partial<StoreApi> = {}): StoreApi & {
  /** Plays the part of the order stream. */
  stream: OrderWatcher;
} {
  const api = {
    stream: { onUpdate: () => {}, onConnectionChange: () => {} } as OrderWatcher,
    listProducts: () => Promise.resolve([]),
    setStock: () => Promise.reject(failure(404)),
    placeOrder: () => Promise.reject(failure(503)),
    getOrder: () => Promise.reject(failure(404)),
    listOrders: () => Promise.resolve(pageOf<OrderSummary>([])),
    watchOrders(watcher: OrderWatcher) {
      api.stream = watcher;
      return () => {};
    },
    getPayment: () => Promise.resolve(null),
    listNotifications: () => Promise.resolve(pageOf([])),
    getSummary: () =>
      Promise.resolve({
        totalOrders: 0,
        confirmed: 0,
        cancelled: 0,
        inProgress: 0,
        confirmedRevenue: 0,
        approvalRate: 0,
        averageSecondsToConfirm: null,
        lastEventAt: null,
      }),
    getOrdersByStatus: () => Promise.resolve([]),
    getRevenue: () => Promise.resolve([]),
    getCancellations: () => Promise.resolve([]),
    getTopProducts: () => Promise.resolve([]),
    ...overrides,
  };
  return api;
}

export function sessionOf(initial: User | null): Session {
  let user = initial;
  const listeners = new Set<() => void>();
  const change = (next: User | null) => {
    user = next;
    listeners.forEach((notify) => notify());
  };
  return {
    getUser: () => user,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: () => change(ana),
    signOut: () => change(null),
  };
}

export function renderApp({
  api = stubApi(),
  user = ana,
  route = '/',
}: {
  api?: StoreApi;
  user?: User | null;
  route?: string;
} = {}) {
  return render(
    <Providers api={api} session={sessionOf(user)}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
