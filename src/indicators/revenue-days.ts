import type { RevenueBucket } from '../api/types';
import type { RevenueDay } from './RevenueChart';

const pad = (value: number) => String(value).padStart(2, '0');

const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The last `count` days as they are on the calendar of whoever is looking, and the
 * UTC dates that cover them, which is what order-analytics takes as `from` and `to`.
 */
export function lastLocalDays(count: number, now = new Date()) {
  const midnight = (daysAgo: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return {
    days: Array.from({ length: count }, (_, index) => localDay(midnight(count - 1 - index))),
    from: utcDay(midnight(count - 1)),
    to: utcDay(new Date(midnight(-1).getTime() - 1)),
  };
}

/**
 * order-analytics groups revenue by UTC day, and the rest of the panel shows local time:
 * in Brazil an order confirmed after 21:00 would land on the bar of the next day. So the
 * revenue is asked by the hour and added up here into local days, with zero where
 * nothing was sold. The buckets start on the UTC hour, so in a zone with a half-hour
 * offset the edge of the day is off by that much.
 */
export function revenueByLocalDay(days: string[], hours: RevenueBucket[]): RevenueDay[] {
  const totals = new Map(days.map((day) => [day, { day, revenue: 0, orders: 0 }]));
  for (const { bucket, revenue, orders } of hours) {
    const total = totals.get(localDay(new Date(bucket)));
    if (!total) continue;
    total.revenue = Math.round((total.revenue + revenue) * 100) / 100;
    total.orders += orders;
  }
  return [...totals.values()];
}
