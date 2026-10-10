import type {
  CancellationReason,
  Notification,
  Order,
  OrderStatus,
  Payment,
  Product,
} from '../types';
import type { Consumer, DomainEvent, EventPayloads, EventType, PricedItem } from './events';

export type TaskAction =
  | { kind: 'deliver'; consumer: Consumer; event: DomainEvent }
  | { kind: 'send-notification'; notificationId: string };

export type Task = { dueAt: number; seq: number } & TaskAction;

export interface Reservation {
  orderId: string;
  status: 'RESERVED' | 'RELEASED';
  items: { productId: string; quantity: number; unitPrice: number }[];
  createdAt: string;
  releasedAt: string | null;
}

/** What order-analytics keeps about an order, folded from the events it has seen. */
export interface OrderFacts {
  status: OrderStatus;
  createdAt: string | null;
  confirmedAt: string | null;
  totalAmount: number;
  cancellationReason: CancellationReason | null;
  items: PricedItem[];
}

/** One table per simulated service. Plain JSON, so it survives a page reload. */
export interface SimState {
  version: number;
  seq: number;
  randomSeed: number;
  tasks: Task[];
  handled: Record<Consumer, Record<string, true>>;
  products: Product[];
  reservations: Record<string, Reservation>;
  orders: Record<string, Order>;
  earlyPayments: Record<string, DomainEvent<'PaymentApproved' | 'PaymentRefused'>>;
  payments: Record<string, Payment>;
  notifications: Notification[];
  analytics: { orders: Record<string, OrderFacts>; lastEventAt: string | null };
}

export interface Context {
  /** Logical time of what is being handled, in epoch milliseconds. */
  now: number;
  newId(): string;
  random(): number;
  publish<T extends EventType>(type: T, orderId: string, payload: EventPayloads[T]): void;
  after(delayMs: number, action: Extract<TaskAction, { kind: 'send-notification' }>): void;
  orderChanged(order: Order): void;
}

export const iso = (time: number) => new Date(time).toISOString();

export const roundMoney = (value: number) => Math.round(value * 100) / 100;
