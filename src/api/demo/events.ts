import type { CancellationReason } from '../types';

interface Customer {
  customerId: string;
  customerName: string;
  customerEmail: string;
}

export interface PricedItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

/** Payload of each event, as published on the Kafka topics of the real system. */
export interface EventPayloads {
  OrderCreated: Customer & { items: { productId: string; quantity: number }[] };
  OrderConfirmed: Customer & { totalAmount: number; items: PricedItem[] };
  OrderCancelled: Customer & { reason: CancellationReason; detail: string };
  StockReserved: { items: PricedItem[]; totalAmount: number };
  StockRejected: {
    reason: 'INSUFFICIENT_STOCK' | 'PRODUCT_NOT_FOUND';
    unavailableItems: { productId: string; requestedQuantity: number; availableQuantity: number }[];
  };
  StockReleased: { items: { productId: string; quantity: number }[] };
  PaymentApproved: { paymentId: string; amount: number };
  PaymentRefused: { paymentId: string; amount: number; reason: string };
}

export type EventType = keyof EventPayloads;

export type DomainEvent<T extends EventType = EventType> = {
  [K in T]: {
    eventId: string;
    type: K;
    orderId: string;
    occurredAt: string;
    payload: EventPayloads[K];
  };
}[T];

export type Consumer =
  | 'order-service'
  | 'inventory-service'
  | 'payment-service'
  | 'notification-service'
  | 'order-analytics';
