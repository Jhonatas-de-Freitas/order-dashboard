import { describe, expect, it } from 'vitest';
import { lastLocalDays, revenueByLocalDay } from './revenue-days';

/** The bucket order-analytics would put a confirmation in, given its local date and time. */
const hourOf = (year: number, month: number, day: number, hour: number) =>
  `${new Date(year, month - 1, day, hour).toISOString().slice(0, 13)}:00:00Z`;

describe('revenue by local day', () => {
  it('listsTheLastDaysOfTheLocalCalendarOldestFirst', () => {
    const { days } = lastLocalDays(3, new Date(2026, 9, 1, 23, 30));

    expect(days).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('asksForTheUtcDatesThatCoverTheLocalDays', () => {
    const now = new Date(2026, 9, 10, 23, 30);
    const { from, to } = lastLocalDays(14, now);

    expect(from).toBe(new Date(2026, 8, 27).toISOString().slice(0, 10));
    expect(to).toBe(new Date(2026, 9, 10, 23, 59, 59).toISOString().slice(0, 10));
  });

  it('putsALateEveningSaleOnTheDayItWasMadeNotOnTheUtcDay', () => {
    const { days } = lastLocalDays(2, new Date(2026, 9, 10, 23, 30));

    const byDay = revenueByLocalDay(days, [
      { bucket: hourOf(2026, 10, 9, 22), revenue: 349.9, orders: 1 },
      { bucket: hourOf(2026, 10, 9, 23), revenue: 129.9, orders: 1 },
      { bucket: hourOf(2026, 10, 10, 0), revenue: 189, orders: 1 },
      { bucket: hourOf(2026, 10, 10, 22), revenue: 2199, orders: 2 },
    ]);

    expect(byDay).toEqual([
      { day: '2026-10-09', revenue: 479.8, orders: 2 },
      { day: '2026-10-10', revenue: 2388, orders: 3 },
    ]);
  });

  it('fillsDaysWithoutSalesWithZeroAndLeavesOutHoursBeforeTheRange', () => {
    const { days } = lastLocalDays(3, new Date(2026, 9, 10, 12));

    const byDay = revenueByLocalDay(days, [
      { bucket: hourOf(2026, 10, 7, 23), revenue: 999, orders: 1 },
      { bucket: hourOf(2026, 10, 10, 9), revenue: 189, orders: 1 },
    ]);

    expect(byDay).toEqual([
      { day: '2026-10-08', revenue: 0, orders: 0 },
      { day: '2026-10-09', revenue: 0, orders: 0 },
      { day: '2026-10-10', revenue: 189, orders: 1 },
    ]);
  });
});
