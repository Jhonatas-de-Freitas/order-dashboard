import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  SearchX,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import { isApiError } from '../api/store-api';
import type {
  Notification,
  NotificationChannel,
  NotificationTemplate,
  Order,
  Payment,
  Product,
} from '../api/types';
import { buttonClass } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import { formatDateTime, formatMoney, formatTime, orderCode, plural } from '../lib/format';
import { usePollingFallback } from './LiveOrders';
import { OrderTimeline } from './OrderTimeline';
import { CANCELLATION, NOTIFICATION_STATUS, isFinal, paymentRefusalLabel } from './status';
import { StatusBadge } from './StatusBadge';
import { orderSteps } from './steps';

/** Notifications trail the order by a moment, and no stream announces them. */
const SETTLING_MS = 12_000;

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const api = useApi();
  const pollingFallback = usePollingFallback();

  const order = useQuery({
    queryKey: keys.order(orderId),
    queryFn: () => api.getOrder(orderId),
    refetchInterval: pollingFallback,
  });
  const found = order.data;
  const settling = () =>
    !found || !isFinal(found.status) || Date.now() - Date.parse(found.updatedAt) < SETTLING_MS;

  const payment = useQuery({
    queryKey: keys.payment(orderId),
    queryFn: () => api.getPayment(orderId),
    enabled: Boolean(found),
    refetchInterval: pollingFallback,
  });
  const notifications = useQuery({
    queryKey: keys.notifications(orderId),
    queryFn: () => api.listNotifications({ orderId }),
    enabled: Boolean(found),
    refetchInterval: (query) => {
      const waiting = query.state.data?.content.some(
        (n) => n.status === 'PENDING' || n.status === 'RETRYING',
      );
      return waiting || settling() ? 2000 : pollingFallback;
    },
  });
  const products = useQuery({ queryKey: keys.products, queryFn: () => api.listProducts() });

  const title = `Pedido ${orderCode(orderId)}`;
  const back = (
    <Link
      to="/pedidos"
      className="type-narrow mb-3 inline-flex items-center gap-1 rounded-sm text-sm text-ink-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      Pedidos
    </Link>
  );

  if (order.isPending) {
    return (
      <>
        {back}
        <PageHeader title={title} />
        <Loading label="Carregando o pedido">
          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </Loading>
      </>
    );
  }

  if (order.isError) {
    return (
      <>
        {back}
        <PageHeader title={title} />
        <div className="sheet">
          {isApiError(order.error, 404) ? (
            <EmptyState
              icon={SearchX}
              title="Pedido não encontrado"
              action={
                <Link to="/pedidos" className={buttonClass()}>
                  Ver os pedidos
                </Link>
              }
            >
              Não existe pedido com este código. Ele pode ter sido digitado errado.
            </EmptyState>
          ) : (
            <ErrorState error={order.error} onRetry={() => void order.refetch()} />
          )}
        </div>
      </>
    );
  }

  const data = order.data;
  return (
    <>
      {back}
      <PageHeader
        title={title}
        description={
          <>
            Feito em {formatDateTime(data.createdAt)} por {data.customerName} ({data.customerEmail})
          </>
        }
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={data.status} large />
          {data.cancellationReason && (
            <span className="text-ink-muted">
              Motivo: {CANCELLATION[data.cancellationReason].toLowerCase()}
            </span>
          )}
        </p>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Panel title="Andamento">
          <div className="px-5 py-5 sm:px-6">
            <OrderTimeline steps={orderSteps(data, payment.data ?? null)} />
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Itens">
            <Items order={data} catalog={products.data ?? []} />
          </Panel>
          <Panel title="Pagamento">
            {payment.isError ? (
              <ErrorState error={payment.error} onRetry={() => void payment.refetch()} />
            ) : payment.isPending ? (
              <PanelSkeleton label="Carregando o pagamento" />
            ) : (
              <PaymentSummary order={data} payment={payment.data} />
            )}
          </Panel>
          <Panel title="Notificações">
            {notifications.isError ? (
              <ErrorState
                error={notifications.error}
                onRetry={() => void notifications.refetch()}
              />
            ) : notifications.isPending ? (
              <PanelSkeleton label="Carregando as notificações" />
            ) : (
              <Notifications sent={notifications.data.content} />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="sheet">
      <h2
        id={id}
        className="type-narrow border-b border-line px-5 py-3 text-sm text-ink-muted sm:px-6"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <div className="px-5 py-4 sm:px-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
    </Loading>
  );
}

function Items({ order, catalog }: { order: Order; catalog: Product[] }) {
  // Names and prices only reach the order once the stock is reserved; until then, and
  // for orders cancelled before that, the catalog fills in the name.
  const nameOf = (productId: string) =>
    catalog.find((product) => product.id === productId)?.name ?? 'Produto';

  return (
    <>
      <ul className="divide-y divide-line">
        {order.items.map((item) => (
          <li
            key={item.productId}
            className="flex items-baseline justify-between gap-4 px-5 py-3 sm:px-6"
          >
            <div>
              <p className="font-semibold">{item.productName ?? nameOf(item.productId)}</p>
              <p className="text-sm text-ink-muted tabular-nums">
                {item.unitPrice === null
                  ? plural(item.quantity, 'unidade', 'unidades')
                  : `${item.quantity} × ${formatMoney(item.unitPrice)}`}
              </p>
            </div>
            {item.unitPrice !== null && (
              <p className="tabular-nums">{formatMoney(item.unitPrice * item.quantity)}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between gap-4 border-t border-line px-5 py-4 sm:px-6">
        <span className="type-narrow text-ink-muted">Total</span>
        {order.totalAmount === null ? (
          <span className="text-right text-sm text-ink-muted">
            {order.status === 'CANCELLED'
              ? 'Sem total: o estoque não chegou a ser reservado'
              : 'Calculado quando o estoque for reservado'}
          </span>
        ) : (
          <strong className="type-wide text-2xl tabular-nums">
            {formatMoney(order.totalAmount)}
          </strong>
        )}
      </p>
    </>
  );
}

function PaymentSummary({ order, payment }: { order: Order; payment: Payment | null }) {
  if (!payment) {
    return (
      <p className="px-5 py-4 text-ink-muted sm:px-6">
        {order.cancellationReason === 'OUT_OF_STOCK'
          ? 'Não houve cobrança: o pedido foi cancelado antes do pagamento.'
          : isFinal(order.status)
            ? 'Não há registro de cobrança para este pedido.'
            : 'A cobrança acontece assim que o estoque for reservado.'}
      </p>
    );
  }
  const approved = payment.status === 'APPROVED';
  return (
    <div
      data-tone={approved ? 'confirmed' : 'cancelled'}
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6"
    >
      <div>
        <p className="font-semibold text-tone">{approved ? 'Aprovado' : 'Recusado'}</p>
        <p className="text-sm text-ink-muted">
          {approved ? 'Cobrança feita' : paymentRefusalLabel(payment.reason)} às{' '}
          <time dateTime={payment.createdAt} className="tabular-nums">
            {formatTime(payment.createdAt)}
          </time>
        </p>
      </div>
      <p className="tabular-nums">{formatMoney(payment.amount)}</p>
    </div>
  );
}

const CHANNEL: Record<NotificationChannel, { icon: LucideIcon; label: string }> = {
  EMAIL: { icon: Mail, label: 'E-mail' },
  PUSH: { icon: Smartphone, label: 'Push' },
  SMS: { icon: MessageSquare, label: 'SMS' },
};

const TEMPLATE: Record<NotificationTemplate, string> = {
  ORDER_RECEIVED: 'Pedido recebido',
  ORDER_CONFIRMED: 'Pedido confirmado',
  ORDER_CANCELLED: 'Pedido cancelado',
  GENERIC: 'Aviso',
};

function Notifications({ sent }: { sent: Notification[] }) {
  if (sent.length === 0) {
    return (
      <p className="px-5 py-4 text-ink-muted sm:px-6">
        Nenhuma notificação ainda. Elas aparecem aqui a cada passo do pedido.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {sent.map((notification) => {
        const { icon: Icon, label } = CHANNEL[notification.channel];
        const status = NOTIFICATION_STATUS[notification.status];
        const destination =
          notification.channel === 'EMAIL'
            ? notification.recipient.email
            : notification.channel === 'SMS'
              ? notification.recipient.phone
              : 'o aplicativo';
        return (
          <li key={notification.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {notification.subject ?? TEMPLATE[notification.template]}
              </p>
              <p className="truncate text-sm text-ink-muted">
                {label}
                {destination && ` para ${destination}`}
                {notification.attempts.length > 1 &&
                  `, ${plural(notification.attempts.length, 'tentativa', 'tentativas')}`}
              </p>
            </div>
            <p data-tone={status.tone} className="shrink-0 text-right text-sm">
              <span className="type-narrow block text-tone">{status.label}</span>
              <time
                dateTime={notification.sentAt ?? notification.createdAt}
                className="text-ink-muted tabular-nums"
              >
                {formatTime(notification.sentAt ?? notification.createdAt)}
              </time>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
