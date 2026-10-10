import type { KeyValueStorage } from '../../lib/storage';
import type { NewOrder, Order, OrderSummary, Product } from '../types';
import { onAnalyticsEvent } from './analytics';
import type { Consumer, DomainEvent, EventType } from './events';
import { onInventoryEvent, setStock } from './inventory';
import { onNotificationEvent, sendNotification } from './notifications';
import { onOrderServiceEvent, placeOrder, summarize } from './orders';
import { onPaymentEvent } from './payments';
import { nextRandom, uuidFrom } from './random';
import { iso, type Context, type SimState, type TaskAction } from './state';

const STORAGE_KEY = 'order-dashboard:demo';
const STATE_VERSION = 1;

type Delay = readonly [min: number, max: number];

/**
 * Who listens to what, and how long each one takes to react. The delays stand in for
 * the broker hop plus the work of the service, so the order moves at a pace a person
 * can follow on screen.
 */
const CONSUMERS: Record<
  Consumer,
  {
    listens: readonly EventType[] | 'all';
    delay: Delay;
    handle: (state: SimState, event: DomainEvent, ctx: Context) => void;
  }
> = {
  'inventory-service': {
    listens: ['OrderCreated', 'OrderCancelled'],
    delay: [1500, 2300],
    handle: onInventoryEvent,
  },
  'payment-service': {
    listens: ['StockReserved'],
    delay: [1700, 2600],
    handle: onPaymentEvent,
  },
  'order-service': {
    listens: ['StockReserved', 'StockRejected', 'PaymentApproved', 'PaymentRefused'],
    delay: [150, 350],
    handle: onOrderServiceEvent,
  },
  'notification-service': {
    listens: ['OrderCreated', 'OrderConfirmed', 'OrderCancelled'],
    delay: [250, 600],
    handle: onNotificationEvent,
  },
  'order-analytics': { listens: 'all', delay: [50, 200], handle: onAnalyticsEvent },
};

/**
 * The whole store running in memory: the five services, each with its own tables,
 * talking only through events. Every reaction is a task with a due time, so the same
 * code runs live (on timers), catches up after a reload and replays past days in an
 * instant when building the demo history.
 */
export class Simulation {
  private state: SimState;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving = true;
  private readonly storage: KeyValueStorage | undefined;
  private readonly watchers = new Set<(order: OrderSummary) => void>();

  constructor(catalog: Product[], storage?: KeyValueStorage) {
    this.storage = storage;
    this.state = emptyState(catalog);
  }

  /** Picks up a previous run of this tab. Returns `false` when there is none. */
  restore(): boolean {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null') as SimState | null;
      if (saved?.version !== STATE_VERSION) return false;
      this.state = saved;
      this.pump();
      return true;
    } catch {
      return false;
    }
  }

  /** Starts over. `history` may place past orders; nothing is saved until it is done. */
  reset(catalog: Product[], history?: (simulation: Simulation) => void): void {
    clearTimeout(this.timer);
    this.state = emptyState(catalog);
    this.saving = false;
    try {
      history?.(this);
    } finally {
      this.saving = true;
    }
    this.afterChange();
  }

  get tables(): Readonly<SimState> {
    return this.state;
  }

  placeOrder(input: NewOrder, at = Date.now()): Order {
    const order = placeOrder(this.state, input, this.context(at));
    this.afterChange();
    return order;
  }

  setStock(productId: string, availableQuantity: number): Product | undefined {
    const product = setStock(this.state, productId, availableQuantity);
    this.afterChange();
    return product;
  }

  /** Hands an event to one consumer, as the broker would. A repeated event is dropped. */
  deliver(consumer: Consumer, event: DomainEvent, at = Date.now()): void {
    this.receive(consumer, event, at);
    this.afterChange();
  }

  /** Runs everything that is still scheduled, without waiting for the clock. */
  settle(): void {
    this.pump(Infinity);
  }

  watchOrders(listener: (order: OrderSummary) => void): () => void {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  private receive(consumer: Consumer, event: DomainEvent, at: number) {
    const handled = this.state.handled[consumer];
    if (handled[event.eventId]) return;
    handled[event.eventId] = true;
    CONSUMERS[consumer].handle(this.state, event, this.context(at));
  }

  private pump(until = Date.now()) {
    for (let task = this.state.tasks[0]; task && task.dueAt <= until; task = this.state.tasks[0]) {
      this.state.tasks.shift();
      if (task.kind === 'deliver') this.receive(task.consumer, task.event, task.dueAt);
      else sendNotification(this.state, task.notificationId, this.context(task.dueAt));
    }
    this.afterChange();
  }

  private afterChange() {
    this.save();
    clearTimeout(this.timer);
    const next = this.state.tasks[0];
    if (next) this.timer = setTimeout(() => this.pump(), Math.max(0, next.dueAt - Date.now()));
  }

  private schedule(dueAt: number, action: TaskAction) {
    this.state.tasks.push({ ...action, dueAt, seq: this.state.seq++ });
    this.state.tasks.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
  }

  private readonly random = (): number => {
    const { value, seed } = nextRandom(this.state.randomSeed);
    this.state.randomSeed = seed;
    return value;
  };

  private context(now: number): Context {
    return {
      now,
      random: this.random,
      newId: () => uuidFrom(this.random),
      publish: (type, orderId, payload) => {
        const event = {
          eventId: uuidFrom(this.random),
          type,
          orderId,
          occurredAt: iso(now),
          payload,
        } as DomainEvent;
        for (const [consumer, { listens, delay }] of Object.entries(CONSUMERS)) {
          if (listens === 'all' || listens.includes(type)) {
            const [min, max] = delay;
            this.schedule(now + min + this.random() * (max - min), {
              kind: 'deliver',
              consumer: consumer as Consumer,
              event,
            });
          }
        }
      },
      after: (delayMs, action) => this.schedule(now + delayMs, action),
      orderChanged: (order) => {
        const summary = summarize(order);
        this.watchers.forEach((notify) => notify(summary));
      },
    };
  }

  private save() {
    if (!this.saving) return;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full or blocked: the demo keeps running, it just will not survive a reload.
    }
  }
}

function emptyState(catalog: Product[]): SimState {
  return {
    version: STATE_VERSION,
    seq: 0,
    randomSeed: 20261010,
    tasks: [],
    handled: {
      'order-service': {},
      'inventory-service': {},
      'payment-service': {},
      'notification-service': {},
      'order-analytics': {},
    },
    products: catalog.map((product) => ({ ...product })),
    reservations: {},
    orders: {},
    earlyPayments: {},
    payments: {},
    notifications: [],
    analytics: { orders: {}, lastEventAt: null },
  };
}
