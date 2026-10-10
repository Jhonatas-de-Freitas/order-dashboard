import { describe, expect, it } from 'vitest';
import { CATALOG } from '../api/demo/seed';
import type { Order, Payment } from '../api/types';
import { orderSteps, summarySteps } from './steps';

const at = (seconds: number) => `2026-10-10T14:03:${String(seconds).padStart(2, '0')}.000Z`;

const pending: Order = {
  id: 'o-1',
  customerId: 'c-1001',
  customerName: 'Ana Souza',
  customerEmail: 'ana@exemplo.com',
  status: 'PENDING',
  totalAmount: null,
  cancellationReason: null,
  cancellationDetail: null,
  items: [{ productId: 'p-1', productName: null, quantity: 1, unitPrice: null }],
  history: [{ status: 'PENDING', occurredAt: at(20), detail: 'Pedido recebido' }],
  createdAt: at(20),
  updatedAt: at(20),
};

const reserved: Order = {
  ...pending,
  status: 'STOCK_RESERVED',
  totalAmount: 7499,
  history: [
    ...pending.history,
    { status: 'STOCK_RESERVED', occurredAt: at(22), detail: 'Estoque reservado' },
  ],
};

const payment = (status: Payment['status']): Payment => ({
  id: 'pay-1',
  orderId: 'o-1',
  amount: 7499,
  status,
  reason: status === 'REFUSED' ? 'LIMIT_EXCEEDED' : null,
  createdAt: at(24),
});

const states = (order: Order, paid: Payment | null = null) =>
  orderSteps(order, paid).map((step) => step.state);

describe('orderSteps', () => {
  it('waitsOnStockRightAfterTheOrderIsPlaced', () => {
    expect(states(pending)).toEqual(['done', 'waiting', 'idle', 'idle']);
  });

  it('waitsOnPaymentOnceStockIsReserved', () => {
    const steps = orderSteps(reserved, null);
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'waiting', 'idle']);
    expect(steps[1]).toMatchObject({ title: 'Estoque reservado', at: at(22) });
  });

  it('marksEveryStopDoneOnAConfirmedOrder', () => {
    const confirmed: Order = {
      ...reserved,
      status: 'CONFIRMED',
      history: [
        ...reserved.history,
        { status: 'CONFIRMED', occurredAt: at(25), detail: 'Pagamento aprovado' },
      ],
    };
    const steps = orderSteps(confirmed, payment('APPROVED'));
    expect(steps.map((step) => step.title)).toEqual([
      'Pedido recebido',
      'Estoque reservado',
      'Pagamento aprovado',
      'Pedido confirmado',
    ]);
    expect(steps.every((step) => step.state === 'done')).toBe(true);
    expect(steps[2]?.at).toBe(at(24));
  });

  it('stopsAtStockAndSkipsPaymentWhenThereIsNoStock', () => {
    // As order-service writes it: the event that refuses the stock has no product names.
    const detail = '44444444-4444-4444-4444-444444444444: pedido 1, disponível 0';
    const cancelled: Order = {
      ...pending,
      status: 'CANCELLED',
      cancellationReason: 'OUT_OF_STOCK',
      cancellationDetail: detail,
      history: [...pending.history, { status: 'CANCELLED', occurredAt: at(22), detail }],
    };
    const steps = orderSteps(cancelled, null, CATALOG);
    expect(steps.map((step) => step.state)).toEqual(['done', 'failed', 'skipped', 'failed']);
    expect(steps[1]).toMatchObject({
      title: 'Sem estoque',
      detail: 'Headset USB: pedido 1, disponível 0',
    });
    expect(steps[3]).toMatchObject({ title: 'Pedido cancelado', detail: 'Sem estoque' });
  });

  it('stopsAtPaymentWhenItIsRefused', () => {
    const cancelled: Order = {
      ...reserved,
      status: 'CANCELLED',
      cancellationReason: 'PAYMENT_REFUSED',
      cancellationDetail: 'Pagamento recusado: LIMIT_EXCEEDED',
      history: [
        ...reserved.history,
        { status: 'CANCELLED', occurredAt: at(25), detail: 'Pagamento recusado: LIMIT_EXCEEDED' },
      ],
    };
    const steps = orderSteps(cancelled, payment('REFUSED'));
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'failed', 'failed']);
    expect(steps[2]).toMatchObject({
      title: 'Pagamento recusado',
      detail: 'Valor acima do limite de aprovação',
    });
    expect(steps[3]?.detail).toBe('Pagamento recusado');

    expect(orderSteps(cancelled, null)[2]).toMatchObject({
      title: 'Pagamento recusado',
      detail: 'Valor acima do limite de aprovação',
    });
  });

  it('showsThePaymentAsSoonAsItExistsEvenBeforeTheOrderCatchesUp', () => {
    expect(states(reserved, payment('APPROVED'))).toEqual(['done', 'done', 'done', 'waiting']);
  });
});

describe('summarySteps', () => {
  it('tellsWhereACancelledOrderStoppedFromItsTotal', () => {
    expect(summarySteps({ status: 'CANCELLED', totalAmount: null })).toEqual([
      'done',
      'failed',
      'idle',
      'idle',
    ]);
    expect(summarySteps({ status: 'CANCELLED', totalAmount: 7499 })).toEqual([
      'done',
      'done',
      'failed',
      'idle',
    ]);
  });
});
