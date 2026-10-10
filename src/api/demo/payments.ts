import type { Payment } from '../types';
import type { DomainEvent } from './events';
import { iso, type Context, type SimState } from './state';

/** Same default as PAYMENT_APPROVAL_LIMIT in the payment-service. */
export const APPROVAL_LIMIT = 5000;

export function onPaymentEvent(state: SimState, event: DomainEvent, ctx: Context): void {
  if (event.type !== 'StockReserved') return;

  const amount = event.payload.totalAmount;
  const approved = amount <= APPROVAL_LIMIT;
  const payment: Payment = {
    id: ctx.newId(),
    orderId: event.orderId,
    amount,
    status: approved ? 'APPROVED' : 'REFUSED',
    reason: approved ? null : 'LIMIT_EXCEEDED',
    createdAt: iso(ctx.now),
  };
  state.payments[event.orderId] = payment;

  if (approved) {
    ctx.publish('PaymentApproved', event.orderId, { paymentId: payment.id, amount });
  } else {
    ctx.publish('PaymentRefused', event.orderId, {
      paymentId: payment.id,
      amount,
      reason: 'LIMIT_EXCEEDED',
    });
  }
}
