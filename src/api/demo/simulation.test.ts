import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewOrder, OrderSummary } from '../types';
import * as analytics from './analytics';
import type { DomainEvent } from './events';
import { CATALOG, placePastOrders } from './seed';
import { Simulation } from './simulation';

const KEYBOARD = '11111111-1111-1111-1111-111111111111';
const MOUSE = '22222222-2222-2222-2222-222222222222';
const HEADSET = '44444444-4444-4444-4444-444444444444';
const NOTEBOOK = '55555555-5555-5555-5555-555555555555';

const orderOf = (...items: [productId: string, quantity: number][]): NewOrder => ({
  customerId: 'c-1001',
  customerName: 'Ana Souza',
  customerEmail: 'ana@exemplo.com',
  items: items.map(([productId, quantity]) => ({ productId, quantity })),
});

const stockOf = (simulation: Simulation, productId: string) =>
  simulation.tables.products.find((product) => product.id === productId)?.availableQuantity;

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T14:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('order saga', () => {
  it('confirmsOrderWhenStockAndPaymentGoThrough', () => {
    const simulation = new Simulation(CATALOG);
    const seen: OrderSummary['status'][] = [];
    simulation.watchOrders((order) => seen.push(order.status));

    const { id } = simulation.placeOrder(orderOf([KEYBOARD, 2]));
    expect(simulation.tables.orders[id]).toMatchObject({ status: 'PENDING', totalAmount: null });

    vi.advanceTimersByTime(10_000);

    expect(simulation.tables.orders[id]).toMatchObject({
      status: 'CONFIRMED',
      totalAmount: 699.8,
      cancellationReason: null,
      items: [{ productName: 'Teclado Mecânico', quantity: 2, unitPrice: 349.9 }],
    });
    expect(simulation.tables.orders[id]?.history.map((entry) => entry.status)).toEqual([
      'PENDING',
      'STOCK_RESERVED',
      'CONFIRMED',
    ]);
    expect(seen).toEqual(['PENDING', 'STOCK_RESERVED', 'CONFIRMED']);
    expect(simulation.tables.payments[id]).toMatchObject({ status: 'APPROVED', amount: 699.8 });
    expect(stockOf(simulation, KEYBOARD)).toBe(48);
  });

  it('takesSecondsNotInstantsToMoveBetweenStates', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([KEYBOARD, 1]));

    vi.advanceTimersByTime(1_400);
    expect(simulation.tables.orders[id]?.status).toBe('PENDING');
    vi.advanceTimersByTime(1_400);
    expect(simulation.tables.orders[id]?.status).toBe('STOCK_RESERVED');
  });

  it('cancelsOrderWhenAnItemIsOutOfStock', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([HEADSET, 1]));

    vi.advanceTimersByTime(10_000);

    expect(simulation.tables.orders[id]).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'OUT_OF_STOCK',
      cancellationDetail: 'Headset USB: pedido 1, disponível 0',
      totalAmount: null,
    });
    expect(simulation.tables.payments[id]).toBeUndefined();
  });

  it('reservesNothingWhenOnlyOneItemIsShort', () => {
    const simulation = new Simulation(CATALOG);
    simulation.placeOrder(orderOf([KEYBOARD, 3], [HEADSET, 1]));

    vi.advanceTimersByTime(10_000);

    expect(stockOf(simulation, KEYBOARD)).toBe(50);
  });

  it('refusesPaymentAboveLimitAndGivesTheStockBack', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([NOTEBOOK, 1]));

    vi.advanceTimersByTime(4_000);
    expect(stockOf(simulation, NOTEBOOK)).toBe(9);
    vi.advanceTimersByTime(10_000);

    expect(simulation.tables.orders[id]).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'PAYMENT_REFUSED',
      totalAmount: 7499,
    });
    expect(simulation.tables.payments[id]).toMatchObject({
      status: 'REFUSED',
      reason: 'LIMIT_EXCEEDED',
    });
    expect(simulation.tables.reservations[id]?.status).toBe('RELEASED');
    expect(stockOf(simulation, NOTEBOOK)).toBe(10);
  });

  it('confirmsHeadsetOrderAfterStockIsAdjusted', () => {
    const simulation = new Simulation(CATALOG);
    simulation.setStock(HEADSET, 5);
    const { id } = simulation.placeOrder(orderOf([HEADSET, 1]));

    vi.advanceTimersByTime(10_000);

    expect(simulation.tables.orders[id]?.status).toBe('CONFIRMED');
    expect(stockOf(simulation, HEADSET)).toBe(4);
  });

  it('notifiesCustomerByEmailAndPushAtEachStep', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([MOUSE, 1]));

    vi.advanceTimersByTime(20_000);

    const sent = simulation.tables.notifications.filter((n) => n.orderId === id);
    expect(sent.map((n) => `${n.template} ${n.channel}`).sort()).toEqual([
      'ORDER_CONFIRMED EMAIL',
      'ORDER_CONFIRMED PUSH',
      'ORDER_RECEIVED EMAIL',
      'ORDER_RECEIVED PUSH',
    ]);
    expect(sent.every((n) => n.status === 'SENT' && n.attempts.at(-1)?.success)).toBe(true);
    expect(sent[0]?.recipient).toMatchObject({
      email: 'ana@exemplo.com',
      deviceToken: 'device-c-1001',
    });
  });
});

describe('event delivery', () => {
  const orderCreated = (orderId: string): DomainEvent => ({
    eventId: 'e-1',
    type: 'OrderCreated',
    orderId,
    occurredAt: '2026-10-10T14:00:00.000Z',
    payload: { ...orderOf([KEYBOARD, 2]) },
  });

  it('ignoresAnEventDeliveredTwice', () => {
    const simulation = new Simulation(CATALOG);

    simulation.deliver('inventory-service', orderCreated('o-1'));
    simulation.deliver('inventory-service', orderCreated('o-1'));

    expect(stockOf(simulation, KEYBOARD)).toBe(48);
  });

  it('keepsAnEarlyPaymentUntilTheReservationArrives', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([KEYBOARD, 2]));

    simulation.deliver('order-service', {
      eventId: 'e-payment',
      type: 'PaymentApproved',
      orderId: id,
      occurredAt: '2026-10-10T14:00:01.000Z',
      payload: { paymentId: 'p-1', amount: 699.8 },
    });
    expect(simulation.tables.orders[id]?.status).toBe('PENDING');

    simulation.deliver('order-service', {
      eventId: 'e-stock',
      type: 'StockReserved',
      orderId: id,
      occurredAt: '2026-10-10T14:00:02.000Z',
      payload: {
        totalAmount: 699.8,
        items: [
          { productId: KEYBOARD, productName: 'Teclado Mecânico', quantity: 2, unitPrice: 349.9 },
        ],
      },
    });

    expect(simulation.tables.orders[id]).toMatchObject({ status: 'CONFIRMED', totalAmount: 699.8 });
  });

  it('ignoresEventsThatArriveAfterAFinalState', () => {
    const simulation = new Simulation(CATALOG);
    const { id } = simulation.placeOrder(orderOf([HEADSET, 1]));
    vi.advanceTimersByTime(10_000);

    simulation.deliver('order-service', {
      eventId: 'e-late',
      type: 'PaymentApproved',
      orderId: id,
      occurredAt: '2026-10-10T14:01:00.000Z',
      payload: { paymentId: 'p-1', amount: 279.5 },
    });

    expect(simulation.tables.orders[id]?.status).toBe('CANCELLED');
    expect(simulation.tables.orders[id]?.history).toHaveLength(2);
  });
});

describe('analytics', () => {
  it('countsOnlyWhatTheEventsSay', () => {
    const simulation = new Simulation(CATALOG);
    simulation.placeOrder(orderOf([KEYBOARD, 2]));
    simulation.placeOrder(orderOf([MOUSE, 1]));
    simulation.placeOrder(orderOf([HEADSET, 1]));
    simulation.placeOrder(orderOf([NOTEBOOK, 1]));
    vi.advanceTimersByTime(20_000);
    simulation.placeOrder(orderOf([KEYBOARD, 1]));
    vi.advanceTimersByTime(500);

    const facts = simulation.tables.analytics;
    const summary = analytics.summary(facts);
    expect(summary).toMatchObject({
      totalOrders: 5,
      confirmed: 2,
      cancelled: 2,
      inProgress: 1,
      confirmedRevenue: 829.7,
      approvalRate: 0.5,
    });
    expect(summary.averageSecondsToConfirm).toBeGreaterThan(3);
    expect(summary.averageSecondsToConfirm).toBeLessThan(6);
    expect(analytics.ordersByStatus(facts)).toEqual([
      { status: 'PENDING', count: 1 },
      { status: 'STOCK_RESERVED', count: 0 },
      { status: 'CONFIRMED', count: 2 },
      { status: 'CANCELLED', count: 2 },
    ]);
    expect(analytics.cancellations(facts)).toEqual(
      expect.arrayContaining([
        { reason: 'OUT_OF_STOCK', count: 1 },
        { reason: 'PAYMENT_REFUSED', count: 1 },
      ]),
    );
    expect(analytics.topProducts(facts, 5)).toEqual([
      { productId: KEYBOARD, productName: 'Teclado Mecânico', quantity: 2, revenue: 699.8 },
      { productId: MOUSE, productName: 'Mouse Sem Fio', quantity: 1, revenue: 129.9 },
    ]);
    expect(
      analytics.revenue(facts, { from: '2026-10-10', to: '2026-10-10', granularity: 'day' }),
    ).toEqual([{ bucket: '2026-10-10', revenue: 829.7, orders: 2 }]);
  });
});

describe('demo history', () => {
  it('buildsPastOrdersThroughTheSameRulesAndRestoresTheStock', () => {
    const simulation = new Simulation(CATALOG);
    simulation.reset(CATALOG, placePastOrders);

    const orders = Object.values(simulation.tables.orders);
    expect(orders.length).toBeGreaterThan(40);
    expect(
      orders.every((order) => order.status === 'CONFIRMED' || order.status === 'CANCELLED'),
    ).toBe(true);
    expect(orders.some((order) => order.cancellationReason === 'OUT_OF_STOCK')).toBe(true);
    expect(orders.some((order) => order.cancellationReason === 'PAYMENT_REFUSED')).toBe(true);
    expect(orders.some((order) => order.customerId === 'c-1001')).toBe(true);
    expect(simulation.tables.tasks).toHaveLength(0);
    expect(simulation.tables.products.map((p) => p.availableQuantity)).toEqual(
      CATALOG.map((p) => p.availableQuantity),
    );
    expect(analytics.summary(simulation.tables.analytics).totalOrders).toBe(orders.length);
  });
});

describe('reload', () => {
  it('picksUpAnOrderThatWasStillMovingWhenThePageClosed', () => {
    const storage = memoryStorage();
    const before = new Simulation(CATALOG, storage);
    const { id } = before.placeOrder(orderOf([KEYBOARD, 1]));
    vi.advanceTimersByTime(500);
    vi.clearAllTimers();

    vi.advanceTimersByTime(60_000);
    const after = new Simulation(CATALOG, storage);

    expect(after.restore()).toBe(true);
    expect(after.tables.orders[id]?.status).toBe('CONFIRMED');
    const [received, , confirmed] = after.tables.orders[id]?.history ?? [];
    expect(
      Date.parse(confirmed?.occurredAt ?? '') - Date.parse(received?.occurredAt ?? ''),
    ).toBeLessThan(6_000);
  });

  it('startsFreshWhenNothingWasSaved', () => {
    expect(new Simulation(CATALOG, memoryStorage()).restore()).toBe(false);
  });
});
