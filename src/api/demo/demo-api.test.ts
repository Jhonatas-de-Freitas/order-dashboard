import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../auth/session';
import type { StoreApi } from '../store-api';
import { createDemoApi } from './demo-api';
import { createDemoSession, type DemoSession } from './demo-session';
import { ADMIN, ANA, CATALOG } from './seed';
import { Simulation } from './simulation';

const KEYBOARD = '11111111-1111-1111-1111-111111111111';
const HEADSET = '44444444-4444-4444-4444-444444444444';

const orderFor = (user: User, items = [{ productId: KEYBOARD, quantity: 1 }]) => ({
  customerId: user.id,
  customerName: user.name,
  customerEmail: user.email,
  items,
});

let simulation: Simulation;
let session: DemoSession;
let api: StoreApi;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T14:00:00Z'));
  simulation = new Simulation(CATALOG);
  session = createDemoSession();
  api = createDemoApi(simulation, session, [0, 0]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('who may call what', () => {
  it('letsAnyoneSeeTheCatalog', async () => {
    session.signOut();

    await expect(api.listProducts()).resolves.toHaveLength(6);
  });

  it('answers401ToOrdersWithoutASession', async () => {
    session.signOut();

    await expect(api.listOrders({})).rejects.toMatchObject({ status: 401 });
    await expect(api.placeOrder(orderFor(ANA))).rejects.toMatchObject({ status: 401 });
  });

  it('answers403WhenACustomerAsksForAdminResources', async () => {
    await expect(api.getSummary()).rejects.toMatchObject({ status: 403 });
    await expect(api.setStock(HEADSET, 5)).rejects.toMatchObject({ status: 403 });
    expect(simulation.tables.products.find((p) => p.id === HEADSET)?.availableQuantity).toBe(0);
  });

  it('letsTheAdminAdjustStockAndReadAnalytics', async () => {
    session.signInAs(ADMIN);

    await expect(api.setStock(HEADSET, 5)).resolves.toMatchObject({ availableQuantity: 5 });
    await expect(api.getSummary()).resolves.toMatchObject({ totalOrders: 0 });
  });
});

describe('orders', () => {
  it('rejectsAnOrderThatBreaksTheRulesNamingEachField', async () => {
    const invalid = orderFor({ ...ANA, email: 'sem-arroba' }, [
      { productId: KEYBOARD, quantity: 0 },
      { productId: KEYBOARD, quantity: 101 },
    ]);

    await expect(api.placeOrder(invalid)).rejects.toMatchObject({
      status: 400,
      problem: {
        errors: [
          { field: 'customerEmail' },
          { field: 'items' },
          { field: 'items[0].quantity' },
          { field: 'items[1].quantity' },
        ],
      },
    });
    expect(Object.keys(simulation.tables.orders)).toHaveLength(0);
  });

  it('rejectsAnEmptyOrder', async () => {
    await expect(api.placeOrder(orderFor(ANA, []))).rejects.toMatchObject({ status: 400 });
  });

  it('limitsABurstOfOrdersAndRecoversAfterAMoment', async () => {
    for (let i = 0; i < 5; i++) await api.placeOrder(orderFor(ANA));

    await expect(api.placeOrder(orderFor(ANA))).rejects.toMatchObject({ status: 429 });

    vi.advanceTimersByTime(1000);
    await expect(api.placeOrder(orderFor(ANA))).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('answers404ForAnOrderThatDoesNotExist', async () => {
    await expect(api.getOrder('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('handsOutCopiesSoLaterEventsDoNotChangeWhatWasAlreadyReturned', async () => {
    const placed = await api.placeOrder(orderFor(ANA));

    vi.advanceTimersByTime(10_000);

    expect(placed.status).toBe('PENDING');
    await expect(api.getOrder(placed.id)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('listsNewestFirstFilteredByCustomerAndStatus', async () => {
    await api.placeOrder(orderFor(ANA));
    vi.advanceTimersByTime(10_000);
    session.signInAs(ADMIN);
    await api.placeOrder(orderFor(ADMIN, [{ productId: HEADSET, quantity: 1 }]));
    vi.advanceTimersByTime(10_000);
    const newest = await api.placeOrder(orderFor(ADMIN));

    const everyone = await api.listOrders({});
    expect(everyone.totalElements).toBe(3);
    expect(everyone.content[0]?.id).toBe(newest.id);

    const onlyAna = await api.listOrders({ customerId: ANA.id });
    expect(onlyAna.content.map((order) => order.customerName)).toEqual(['Ana Souza']);

    const cancelled = await api.listOrders({ status: 'CANCELLED' });
    expect(cancelled.content).toHaveLength(1);
    expect(cancelled.content[0]).toMatchObject({ totalAmount: null, itemCount: 1 });
  });

  it('hasNoPaymentUntilTheOrderIsCharged', async () => {
    const placed = await api.placeOrder(orderFor(ANA));
    await expect(api.getPayment(placed.id)).resolves.toBeNull();

    vi.advanceTimersByTime(10_000);

    await expect(api.getPayment(placed.id)).resolves.toMatchObject({ status: 'APPROVED' });
  });

  it('tellsWatchersAboutEachChangeUntilTheyStopWatching', async () => {
    const seen: string[] = [];
    const stop = api.watchOrders({ onUpdate: (order) => seen.push(order.status) });

    await api.placeOrder(orderFor(ANA));
    vi.advanceTimersByTime(3_000);
    stop();
    vi.advanceTimersByTime(10_000);

    expect(seen).toEqual(['PENDING', 'STOCK_RESERVED']);
  });
});
