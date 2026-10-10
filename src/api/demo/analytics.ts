import type {
  AnalyticsSummary,
  CancellationCount,
  CancellationReason,
  OrderStatus,
  RevenueBucket,
  RevenueQuery,
  StatusCount,
  TopProduct,
} from '../types';
import type { DomainEvent } from './events';
import { roundMoney, type OrderFacts, type SimState } from './state';

type Analytics = SimState['analytics'];

export function onAnalyticsEvent(state: SimState, event: DomainEvent): void {
  const analytics = state.analytics;
  if (!analytics.lastEventAt || event.occurredAt > analytics.lastEventAt) {
    analytics.lastEventAt = event.occurredAt;
  }

  // Topics are consumed independently, so a StockReserved may be seen before its OrderCreated.
  const facts = (analytics.orders[event.orderId] ??= {
    status: 'PENDING',
    createdAt: null,
    confirmedAt: null,
    totalAmount: 0,
    cancellationReason: null,
    items: [],
  });
  const finished = facts.status === 'CONFIRMED' || facts.status === 'CANCELLED';

  switch (event.type) {
    case 'OrderCreated':
      facts.createdAt = event.occurredAt;
      break;
    case 'StockReserved':
      if (!finished) facts.status = 'STOCK_RESERVED';
      break;
    case 'OrderConfirmed':
      facts.status = 'CONFIRMED';
      facts.confirmedAt = event.occurredAt;
      facts.totalAmount = event.payload.totalAmount;
      facts.items = event.payload.items;
      break;
    case 'OrderCancelled':
      facts.status = 'CANCELLED';
      facts.cancellationReason = event.payload.reason;
      break;
    default:
      break;
  }
}

const round = (value: number, places: number) => Number(value.toFixed(places));

const confirmedOrders = (analytics: Analytics) =>
  Object.values(analytics.orders).filter(
    (facts): facts is OrderFacts & { confirmedAt: string } => facts.confirmedAt !== null,
  );

export function summary(analytics: Analytics): AnalyticsSummary {
  const all = Object.values(analytics.orders);
  const confirmed = confirmedOrders(analytics);
  const cancelled = all.filter((facts) => facts.status === 'CANCELLED').length;
  const finished = confirmed.length + cancelled;
  const secondsToConfirm = confirmed.flatMap((facts) =>
    facts.createdAt ? [(Date.parse(facts.confirmedAt) - Date.parse(facts.createdAt)) / 1000] : [],
  );

  return {
    totalOrders: all.length,
    confirmed: confirmed.length,
    cancelled,
    inProgress: all.length - finished,
    confirmedRevenue: roundMoney(confirmed.reduce((sum, facts) => sum + facts.totalAmount, 0)),
    approvalRate: finished === 0 ? 0 : round(confirmed.length / finished, 4),
    averageSecondsToConfirm:
      secondsToConfirm.length === 0
        ? null
        : round(
            secondsToConfirm.reduce((sum, seconds) => sum + seconds, 0) / secondsToConfirm.length,
            2,
          ),
    lastEventAt: analytics.lastEventAt,
  };
}

export function ordersByStatus(analytics: Analytics): StatusCount[] {
  const statuses: OrderStatus[] = ['PENDING', 'STOCK_RESERVED', 'CONFIRMED', 'CANCELLED'];
  const all = Object.values(analytics.orders);
  return statuses.map((status) => ({
    status,
    count: all.filter((facts) => facts.status === status).length,
  }));
}

export function revenue(analytics: Analytics, query: RevenueQuery): RevenueBucket[] {
  const buckets = new Map<string, RevenueBucket>();
  for (const facts of confirmedOrders(analytics)) {
    const day = facts.confirmedAt.slice(0, 10);
    if (day < query.from || day > query.to) continue;
    const bucket = query.granularity === 'day' ? day : `${facts.confirmedAt.slice(0, 13)}:00:00Z`;
    const entry = buckets.get(bucket) ?? { bucket, revenue: 0, orders: 0 };
    entry.revenue = roundMoney(entry.revenue + facts.totalAmount);
    entry.orders += 1;
    buckets.set(bucket, entry);
  }
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export function cancellations(analytics: Analytics): CancellationCount[] {
  const counts = new Map<CancellationReason, number>();
  for (const facts of Object.values(analytics.orders)) {
    if (facts.cancellationReason) {
      counts.set(facts.cancellationReason, (counts.get(facts.cancellationReason) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export function topProducts(analytics: Analytics, limit: number): TopProduct[] {
  const products = new Map<string, TopProduct>();
  for (const facts of confirmedOrders(analytics)) {
    for (const item of facts.items) {
      const entry = products.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += item.quantity;
      entry.revenue = roundMoney(entry.revenue + item.quantity * item.unitPrice);
      products.set(item.productId, entry);
    }
  }
  return [...products.values()]
    .sort(
      (a, b) =>
        b.quantity - a.quantity || b.revenue - a.revenue || a.productId.localeCompare(b.productId),
    )
    .slice(0, limit);
}
