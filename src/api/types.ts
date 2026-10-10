// Shapes of the REST resources, exactly as the api-gateway returns them.

export type OrderStatus = 'PENDING' | 'STOCK_RESERVED' | 'CONFIRMED' | 'CANCELLED';
export type CancellationReason = 'OUT_OF_STOCK' | 'PAYMENT_REFUSED';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  availableQuantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string | null;
  quantity: number;
  unitPrice: number | null;
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  occurredAt: string;
  detail: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  totalAmount: number | null;
  cancellationReason: CancellationReason | null;
  cancellationDetail: string | null;
  items: OrderItem[];
  history: OrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: { productId: string; quantity: number }[];
}

export interface OrderQuery {
  status?: OrderStatus;
  customerId?: string;
  page?: number;
  size?: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: 'APPROVED' | 'REFUSED';
  reason: string | null;
  createdAt: string;
}

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';
export type NotificationTemplate =
  'ORDER_RECEIVED' | 'ORDER_CONFIRMED' | 'ORDER_CANCELLED' | 'GENERIC';
export type NotificationStatus =
  'SCHEDULED' | 'PENDING' | 'RETRYING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface NotificationAttempt {
  number: number;
  at: string;
  success: boolean;
  error: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  orderId: string | null;
  channel: NotificationChannel;
  template: NotificationTemplate;
  recipient: {
    name: string;
    email: string | null;
    phone: string | null;
    deviceToken: string | null;
  };
  subject: string | null;
  status: NotificationStatus;
  attempts: NotificationAttempt[];
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalOrders: number;
  confirmed: number;
  cancelled: number;
  inProgress: number;
  confirmedRevenue: number;
  /** Share of finished orders that were confirmed, from 0 to 1. */
  approvalRate: number;
  averageSecondsToConfirm: number | null;
  lastEventAt: string | null;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export interface RevenueQuery {
  /** Inclusive, `YYYY-MM-DD` (UTC). */
  from: string;
  to: string;
  granularity: 'day' | 'hour';
}

export interface RevenueBucket {
  bucket: string;
  revenue: number;
  orders: number;
}

export interface CancellationCount {
  reason: CancellationReason;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}
