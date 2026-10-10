import type { CancellationReason, NotificationStatus, OrderStatus } from '../api/types';

export type Tone = 'received' | 'reserved' | 'confirmed' | 'cancelled' | 'neutral';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'STOCK_RESERVED',
  'CONFIRMED',
  'CANCELLED',
];

export const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Recebido', tone: 'received' },
  STOCK_RESERVED: { label: 'Estoque reservado', tone: 'reserved' },
  CONFIRMED: { label: 'Confirmado', tone: 'confirmed' },
  CANCELLED: { label: 'Cancelado', tone: 'cancelled' },
};

export const CANCELLATION: Record<CancellationReason, string> = {
  OUT_OF_STOCK: 'Sem estoque',
  PAYMENT_REFUSED: 'Pagamento recusado',
};

export const NOTIFICATION_STATUS: Record<NotificationStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Agendada', tone: 'neutral' },
  PENDING: { label: 'Na fila', tone: 'received' },
  RETRYING: { label: 'Tentando de novo', tone: 'reserved' },
  SENT: { label: 'Enviada', tone: 'confirmed' },
  FAILED: { label: 'Falhou', tone: 'cancelled' },
  SKIPPED: { label: 'Não enviada', tone: 'neutral' },
};

export const isFinal = (status: OrderStatus) => status === 'CONFIRMED' || status === 'CANCELLED';

export const paymentRefusalLabel = (reason: string | null) =>
  reason === 'LIMIT_EXCEEDED'
    ? 'Valor acima do limite de aprovação'
    : (reason ?? 'Sem motivo informado');
