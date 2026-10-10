import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatMoney,
  formatPercent,
  formatRecent,
  orderCode,
  plural,
} from './format';

// Intl separates the currency symbol with a non-breaking space.
const plain = (text: string) => text.replaceAll(String.fromCharCode(160), ' ');

describe('format', () => {
  it('writesMoneyInReais', () => {
    expect(plain(formatMoney(1234.56))).toBe('R$ 1.234,56');
    expect(plain(formatMoney(0))).toBe('R$ 0,00');
  });

  it('namesTodayAndYesterdayAndDatesTheRest', () => {
    const now = new Date(2026, 9, 10, 15, 0);
    expect(formatRecent(new Date(2026, 9, 10, 14, 3).toISOString(), now)).toBe('hoje, 14:03');
    expect(formatRecent(new Date(2026, 9, 9, 23, 59).toISOString(), now)).toBe('ontem, 23:59');
    expect(formatRecent(new Date(2026, 9, 1, 8, 5).toISOString(), now)).toBe('01/10, 08:05');
  });

  it('writesShortDurationsInSecondsAndLongOnesInMinutes', () => {
    expect(formatDuration(4.26)).toBe('4,3 s');
    expect(formatDuration(72)).toBe('1 min 12 s');
  });

  it('writesAFractionAsPercent', () => {
    expect(formatPercent(0.873)).toBe('87%');
  });

  it('shortensTheOrderIdToACodePeopleCanRead', () => {
    expect(orderCode('7c1f0a34-5b1d-4f6e-8a2b-9d3e4f5a6b7c')).toBe('#7C1F0A34');
  });

  it('agreesTheNounWithTheCount', () => {
    expect(plural(1, 'pedido', 'pedidos')).toBe('1 pedido');
    expect(plural(2, 'pedido', 'pedidos')).toBe('2 pedidos');
  });
});
