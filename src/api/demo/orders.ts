import type { CancellationReason, NewOrder, Order, OrderQuery, OrderSummary, Page } from '../types';
import type { DomainEvent, EventPayloads } from './events';
import { iso, type Context, type SimState } from './state';

const isFinal = (order: Order) => order.status === 'CONFIRMED' || order.status === 'CANCELLED';

export function summarize(order: Order): OrderSummary {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    status: order.status,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function placeOrder(state: SimState, input: NewOrder, ctx: Context): Order {
  const at = iso(ctx.now);
  const order: Order = {
    id: ctx.newId(),
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    status: 'PENDING',
    totalAmount: null,
    cancellationReason: null,
    cancellationDetail: null,
    items: input.items.map(({ productId, quantity }) => ({
      productId,
      productName: null,
      quantity,
      unitPrice: null,
    })),
    history: [{ status: 'PENDING', occurredAt: at, detail: 'Pedido recebido' }],
    createdAt: at,
    updatedAt: at,
  };
  state.orders[order.id] = order;
  ctx.publish('OrderCreated', order.id, {
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
  });
  ctx.orderChanged(order);
  return order;
}

export function listOrders(state: SimState, query: OrderQuery): Page<OrderSummary> {
  const page = query.page ?? 0;
  const size = query.size ?? 20;
  const matching = Object.values(state.orders)
    .filter((order) => !query.status || order.status === query.status)
    .filter((order) => !query.customerId || order.customerId === query.customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    content: matching.slice(page * size, (page + 1) * size).map(summarize),
    page,
    size,
    totalElements: matching.length,
    totalPages: Math.ceil(matching.length / size),
  };
}

export function onOrderServiceEvent(state: SimState, event: DomainEvent, ctx: Context): void {
  const order = state.orders[event.orderId];
  if (!order || isFinal(order)) return;

  switch (event.type) {
    case 'StockReserved': {
      if (order.status !== 'PENDING') return;
      order.items = event.payload.items.map((item) => ({ ...item }));
      order.totalAmount = event.payload.totalAmount;
      moveTo(order, 'STOCK_RESERVED', 'Estoque reservado', ctx);

      const early = state.earlyPayments[order.id];
      if (early) {
        delete state.earlyPayments[order.id];
        onOrderServiceEvent(state, early, ctx);
      }
      return;
    }
    case 'StockRejected': {
      cancel(order, 'OUT_OF_STOCK', stockRejectedDetail(event.payload), ctx);
      return;
    }
    case 'PaymentApproved':
    case 'PaymentRefused': {
      if (order.status === 'PENDING') {
        // Payment and stock travel on different topics, so the payment can overtake the
        // reservation. It waits here until the reservation shows up.
        state.earlyPayments[order.id] = event;
        return;
      }
      if (event.type === 'PaymentRefused') {
        cancel(order, 'PAYMENT_REFUSED', refusalDetail(event.payload.reason), ctx);
        return;
      }
      moveTo(order, 'CONFIRMED', 'Pagamento aprovado', ctx);
      ctx.publish('OrderConfirmed', order.id, {
        customerId: order.customerId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        totalAmount: order.totalAmount ?? 0,
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName ?? '',
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 0,
        })),
      });
      return;
    }
    default:
      return;
  }
}

// The same lines order-service writes. The event has no product names, so the detail
// carries ids, and the screen puts the names back.
function stockRejectedDetail({ reason, unavailableItems }: EventPayloads['StockRejected']) {
  if (unavailableItems.length === 0) return 'Sem estoque';
  if (reason === 'PRODUCT_NOT_FOUND') {
    return `Produto não encontrado: ${unavailableItems.map((item) => item.productId).join(', ')}`;
  }
  return unavailableItems
    .map(
      (item) =>
        `${item.productId}: pedido ${item.requestedQuantity}, disponível ${item.availableQuantity}`,
    )
    .join('; ');
}

const refusalDetail = (reason: string) => `Pagamento recusado: ${reason}`;

function cancel(order: Order, reason: CancellationReason, detail: string, ctx: Context) {
  order.cancellationReason = reason;
  order.cancellationDetail = detail;
  moveTo(order, 'CANCELLED', detail, ctx);
  ctx.publish('OrderCancelled', order.id, {
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    reason,
    detail,
  });
}

function moveTo(order: Order, status: Order['status'], detail: string, ctx: Context) {
  const at = iso(ctx.now);
  order.status = status;
  order.updatedAt = at;
  order.history.push({ status, occurredAt: at, detail });
  ctx.orderChanged(order);
}
