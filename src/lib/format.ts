const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integer = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const clockWithSeconds = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const longDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });

export const formatMoney = (value: number) => money.format(value);
export const formatCount = (value: number) => integer.format(value);
export const formatPercent = (fraction: number) => percent.format(fraction);

export const formatTime = (isoDate: string) => clockWithSeconds.format(new Date(isoDate));

export const formatDateTime = (isoDate: string) =>
  `${longDate.format(new Date(isoDate))}, ${clock.format(new Date(isoDate))}`;

/** "hoje, 14:03", "ontem, 09:12" or "08/10, 14:03". */
export function formatRecent(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const day = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : shortDate.format(date);
  return `${day}, ${clock.format(date)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${decimal.format(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}

/** Short form of the order id for people to read and say out loud. */
export const orderCode = (orderId: string) => `#${orderId.slice(0, 8).toUpperCase()}`;

export const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;
