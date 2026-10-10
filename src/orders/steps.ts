import type { Order, OrderStatus, Payment } from '../api/types';
import { formatMoney } from '../lib/format';
import { CANCELLATION, paymentRefusalLabel, type Tone } from './status';

export type StepState = 'done' | 'waiting' | 'failed' | 'skipped' | 'idle';

export interface Step {
  key: 'received' | 'stock' | 'payment' | 'outcome';
  title: string;
  state: StepState;
  tone: Tone;
  at?: string;
  detail?: string;
}

/**
 * The four stops every order goes through, in order. The order history only records
 * state changes, so the payment stop comes from the payment itself.
 */
export function orderSteps(order: Order, payment: Payment | null): Step[] {
  const at = (status: OrderStatus) =>
    order.history.find((entry) => entry.status === status)?.occurredAt;
  const outOfStock = order.cancellationReason === 'OUT_OF_STOCK';
  const refused = order.cancellationReason === 'PAYMENT_REFUSED' || payment?.status === 'REFUSED';
  const reserved = order.status !== 'PENDING' && !outOfStock;
  const approved = order.status === 'CONFIRMED' || payment?.status === 'APPROVED';

  const stock: Step = outOfStock
    ? {
        key: 'stock',
        title: 'Sem estoque',
        state: 'failed',
        tone: 'cancelled',
        at: at('CANCELLED'),
        detail: order.cancellationDetail ?? undefined,
      }
    : reserved
      ? {
          key: 'stock',
          title: 'Estoque reservado',
          state: 'done',
          tone: 'reserved',
          at: at('STOCK_RESERVED'),
        }
      : { key: 'stock', title: 'Reservando estoque', state: 'waiting', tone: 'received' };

  let paymentStep: Step;
  if (outOfStock) {
    paymentStep = {
      key: 'payment',
      title: 'Pagamento',
      state: 'skipped',
      tone: 'neutral',
      detail: 'Não houve cobrança',
    };
  } else if (refused) {
    paymentStep = {
      key: 'payment',
      title: 'Pagamento recusado',
      state: 'failed',
      tone: 'cancelled',
      at: payment?.createdAt ?? at('CANCELLED'),
      detail: payment
        ? paymentRefusalLabel(payment.reason)
        : (order.cancellationDetail ?? undefined),
    };
  } else if (approved) {
    paymentStep = {
      key: 'payment',
      title: 'Pagamento aprovado',
      state: 'done',
      tone: 'confirmed',
      at: payment?.createdAt ?? at('CONFIRMED'),
      detail: payment ? formatMoney(payment.amount) : undefined,
    };
  } else if (reserved) {
    paymentStep = {
      key: 'payment',
      title: 'Processando pagamento',
      state: 'waiting',
      tone: 'reserved',
    };
  } else {
    paymentStep = { key: 'payment', title: 'Pagamento', state: 'idle', tone: 'neutral' };
  }

  const outcome: Step =
    order.status === 'CONFIRMED'
      ? {
          key: 'outcome',
          title: 'Pedido confirmado',
          state: 'done',
          tone: 'confirmed',
          at: at('CONFIRMED'),
        }
      : order.status === 'CANCELLED'
        ? {
            key: 'outcome',
            title: 'Pedido cancelado',
            state: 'failed',
            tone: 'cancelled',
            at: at('CANCELLED'),
            detail: order.cancellationReason ? CANCELLATION[order.cancellationReason] : undefined,
          }
        : {
            key: 'outcome',
            title: 'Confirmação',
            state: payment ? 'waiting' : 'idle',
            tone: 'neutral',
          };

  return [
    {
      key: 'received',
      title: 'Pedido recebido',
      state: 'done',
      tone: 'received',
      at: at('PENDING'),
    },
    stock,
    paymentStep,
    outcome,
  ];
}

/**
 * The same four stops for a row of the list, which only has the summary. A cancelled
 * order with no total never had its stock reserved (the total only exists after the
 * reservation), so it stopped at the second stop; with a total, it stopped at payment.
 */
export function summarySteps(order: {
  status: OrderStatus;
  totalAmount: number | null;
}): StepState[] {
  switch (order.status) {
    case 'PENDING':
      return ['done', 'waiting', 'idle', 'idle'];
    case 'STOCK_RESERVED':
      return ['done', 'done', 'waiting', 'idle'];
    case 'CONFIRMED':
      return ['done', 'done', 'done', 'done'];
    case 'CANCELLED':
      return order.totalAmount === null
        ? ['done', 'failed', 'idle', 'idle']
        : ['done', 'done', 'failed', 'idle'];
  }
}
