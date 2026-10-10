import type { Product } from '../types';
import type { DomainEvent, PricedItem } from './events';
import { iso, roundMoney, type Context, type SimState } from './state';

export function setStock(
  state: SimState,
  productId: string,
  availableQuantity: number,
): Product | undefined {
  const product = state.products.find((p) => p.id === productId);
  if (product) product.availableQuantity = availableQuantity;
  return product;
}

export function onInventoryEvent(state: SimState, event: DomainEvent, ctx: Context): void {
  if (event.type === 'OrderCreated') reserve(state, event, ctx);
  if (event.type === 'OrderCancelled') release(state, event.orderId, ctx);
}

/** All or nothing: if any item is short, no stock is taken. */
function reserve(state: SimState, event: DomainEvent<'OrderCreated'>, ctx: Context) {
  const lines = event.payload.items.map((item) => ({
    ...item,
    product: state.products.find((p) => p.id === item.productId),
  }));
  const unavailable = lines.filter(
    (line) => !line.product || line.product.availableQuantity < line.quantity,
  );

  if (unavailable.length > 0) {
    ctx.publish('StockRejected', event.orderId, {
      reason: unavailable.some((line) => !line.product)
        ? 'PRODUCT_NOT_FOUND'
        : 'INSUFFICIENT_STOCK',
      unavailableItems: unavailable.map((line) => ({
        productId: line.productId,
        requestedQuantity: line.quantity,
        availableQuantity: line.product?.availableQuantity ?? 0,
      })),
    });
    return;
  }

  const items: PricedItem[] = [];
  for (const { product, quantity } of lines) {
    if (!product) continue;
    product.availableQuantity -= quantity;
    items.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
    });
  }
  state.reservations[event.orderId] = {
    orderId: event.orderId,
    status: 'RESERVED',
    items: items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
    createdAt: iso(ctx.now),
    releasedAt: null,
  };
  ctx.publish('StockReserved', event.orderId, {
    items,
    totalAmount: roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
  });
}

function release(state: SimState, orderId: string, ctx: Context) {
  const reservation = state.reservations[orderId];
  if (reservation?.status !== 'RESERVED') return;

  for (const item of reservation.items) {
    const product = state.products.find((p) => p.id === item.productId);
    if (product) product.availableQuantity += item.quantity;
  }
  reservation.status = 'RELEASED';
  reservation.releasedAt = iso(ctx.now);
  ctx.publish('StockReleased', orderId, {
    items: reservation.items.map(({ productId, quantity }) => ({ productId, quantity })),
  });
}
