import type {
  AnalyticsSummary,
  CancellationCount,
  NewOrder,
  Notification,
  Order,
  OrderQuery,
  OrderSummary,
  Page,
  Payment,
  Product,
  RevenueBucket,
  RevenueQuery,
  StatusCount,
  TopProduct,
} from './types';

export interface OrderWatcher {
  onUpdate(order: OrderSummary): void;
  /** `false` while the stream is down: callers should poll until it comes back. */
  onConnectionChange?(connected: boolean): void;
}

/**
 * Everything the screens need from the backend. The demo build answers from a
 * simulation running in the browser; the real build goes through the api-gateway.
 */
export interface StoreApi {
  listProducts(): Promise<Product[]>;
  setStock(productId: string, availableQuantity: number): Promise<Product>;

  placeOrder(order: NewOrder): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  listOrders(query: OrderQuery): Promise<Page<OrderSummary>>;
  watchOrders(watcher: OrderWatcher): () => void;

  /** Resolves to `null` while the order has no charge yet. */
  getPayment(orderId: string): Promise<Payment | null>;
  listNotifications(query: { orderId: string; size?: number }): Promise<Page<Notification>>;

  getSummary(): Promise<AnalyticsSummary>;
  getOrdersByStatus(): Promise<StatusCount[]>;
  getRevenue(query: RevenueQuery): Promise<RevenueBucket[]>;
  getCancellations(): Promise<CancellationCount[]>;
  getTopProducts(limit: number): Promise<TopProduct[]>;
}

/** RFC 7807 body, as every service behind the gateway answers on error. */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}
