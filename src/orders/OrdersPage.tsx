import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import type { OrderQuery, OrderStatus, OrderSummary } from '../api/types';
import { isAdmin } from '../auth/session';
import { useUser } from '../auth/SessionContext';
import { Button, buttonClass } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import { cx } from '../lib/cx';
import { formatMoney, formatRecent, orderCode, plural } from '../lib/format';
import { useLive, usePollingFallback } from './LiveOrders';
import { OrderTrack } from './OrderTrack';
import { ORDER_STATUSES, STATUS } from './status';
import { StatusBadge } from './StatusBadge';

const PAGE_SIZE = 10;

// A table only from 1024 px on: below that the six columns do not fit side by side,
// and each order is a card.
const COLUMNS =
  'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_4.5rem_8rem_6.5rem_10.5rem] lg:items-center lg:gap-x-6';

export function OrdersPage() {
  const api = useApi();
  const user = useUser();
  const { connected } = useLive();
  const refetchInterval = usePollingFallback();
  const [params, setParams] = useSearchParams();
  const placed = (useLocation().state as { placed?: string } | null)?.placed;

  const status = ORDER_STATUSES.find((candidate) => candidate === params.get('estado'));
  const page = Math.max(1, Number(params.get('pagina')) || 1) - 1;
  const query: OrderQuery = {
    status,
    customerId: isAdmin(user) ? undefined : user.id,
    page,
    size: PAGE_SIZE,
  };

  const orders = useQuery({
    queryKey: keys.orderList(query),
    queryFn: () => api.listOrders(query),
    placeholderData: keepPreviousData,
    refetchInterval,
  });

  // A page past the end is not an empty list: the address may come from a link, or from
  // someone with more orders who was signed in before on this tab.
  const lastPage =
    orders.data && !orders.isPlaceholderData ? Math.max(orders.data.totalPages - 1, 0) : null;
  const pastTheEnd = lastPage !== null && page > lastPage;
  useEffect(() => {
    if (!pastTheEnd) return;
    setParams(
      (current) => {
        const search = new URLSearchParams(current);
        if (lastPage) search.set('pagina', String(lastPage + 1));
        else search.delete('pagina');
        return search;
      },
      { replace: true },
    );
  }, [pastTheEnd, lastPage, setParams]);

  const show = (next: { status?: OrderStatus; page?: number }) => {
    const search = new URLSearchParams();
    if (next.status) search.set('estado', next.status);
    if (next.page) search.set('pagina', String(next.page + 1));
    setParams(search, { state: null });
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={
          isAdmin(user)
            ? 'Todos os pedidos da loja, do mais novo para o mais antigo.'
            : 'Os seus pedidos, do mais novo para o mais antigo.'
        }
      >
        <p className="type-narrow flex items-center gap-2 text-sm text-ink-muted">
          <span
            aria-hidden
            data-tone={connected ? 'confirmed' : 'neutral'}
            className={cx('size-2 rounded-full bg-tone-solid', connected && 'animate-waiting')}
          />
          {connected
            ? 'Ao vivo: o estado muda sozinho'
            : 'Sem conexão ao vivo, atualizando a cada 5 s'}
        </p>
      </PageHeader>

      <div role="group" aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={!status} onClick={() => show({})}>
          Todos
        </FilterChip>
        {ORDER_STATUSES.map((option) => (
          <FilterChip
            key={option}
            active={status === option}
            onClick={() => show({ status: option })}
          >
            {STATUS[option].label}
          </FilterChip>
        ))}
      </div>

      <section aria-label="Lista de pedidos" className="sheet overflow-hidden">
        {orders.isPending || pastTheEnd ? (
          <OrdersSkeleton />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.content.length === 0 ? (
          status ? (
            <EmptyState
              icon={Inbox}
              title={`Nenhum pedido com o estado “${STATUS[status].label}”`}
              action={<Button onClick={() => show({})}>Ver todos os pedidos</Button>}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Nenhum pedido ainda"
              action={
                <Link to="/" className={buttonClass('primary')}>
                  Ir para a loja
                </Link>
              }
            >
              Faça o primeiro pedido na loja e acompanhe aqui cada passo dele.
            </EmptyState>
          )
        ) : (
          <>
            <div
              aria-hidden
              className={cx(
                'type-narrow hidden border-b border-line px-6 py-3 text-sm text-ink-muted lg:grid',
                COLUMNS,
              )}
            >
              <span>Pedido</span>
              <span>Feito</span>
              <span>Itens</span>
              <span className="text-right">Total</span>
              <span>Andamento</span>
              <span>Estado</span>
            </div>
            <ul
              className={cx(
                'divide-y divide-line transition-opacity',
                orders.isPlaceholderData && 'opacity-60',
              )}
            >
              {orders.data.content.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  showCustomer={isAdmin(user)}
                  justPlaced={order.id === placed}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {orders.data && orders.data.totalPages > 1 && !pastTheEnd && (
        <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            Página {orders.data.page + 1} de {orders.data.totalPages},{' '}
            {plural(orders.data.totalElements, 'pedido', 'pedidos')}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={page === 0}
              onClick={() => show({ status, page: page - 1 })}
            >
              <ChevronLeft aria-hidden className="size-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              disabled={page >= orders.data.totalPages - 1}
              onClick={() => show({ status, page: page + 1 })}
            >
              Próxima
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'type-narrow h-8 rounded-full border px-3 text-sm transition-colors',
        active
          ? 'border-action bg-action text-action-ink'
          : 'border-line-strong bg-surface text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function OrderRow({
  order,
  showCustomer,
  justPlaced,
}: {
  order: OrderSummary;
  showCustomer: boolean;
  justPlaced: boolean;
}) {
  return (
    <li data-tone={STATUS[order.status].tone} className={cx(justPlaced && 'animate-row-flash')}>
      <Link
        to={`/pedidos/${order.id}`}
        className={cx(
          'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-5 py-4 -outline-offset-2 hover:bg-sunken/50 sm:px-6 lg:py-3',
          COLUMNS,
        )}
      >
        <span className="col-start-1 row-start-1 min-w-0">
          <span className="block font-semibold tabular-nums">{orderCode(order.id)}</span>
          {showCustomer && (
            <span className="block truncate text-sm text-ink-muted">{order.customerName}</span>
          )}
        </span>
        <span className="col-start-1 row-start-3 text-sm whitespace-nowrap text-ink-muted tabular-nums lg:col-start-2 lg:row-start-1 lg:text-base lg:text-ink">
          {formatRecent(order.createdAt)}
        </span>
        <span className="col-start-2 row-start-3 text-right text-sm text-ink-muted tabular-nums lg:col-start-3 lg:row-start-1 lg:text-left lg:text-base lg:text-ink">
          {order.itemCount}
          <span className="lg:sr-only"> {order.itemCount === 1 ? 'item' : 'itens'}</span>
        </span>
        <span className="col-start-2 row-start-1 text-right font-semibold tabular-nums lg:col-start-4">
          {order.totalAmount === null ? (
            <span className="font-normal text-ink-subtle">
              <span aria-hidden>—</span>
              <span className="sr-only">Total ainda não calculado</span>
            </span>
          ) : (
            formatMoney(order.totalAmount)
          )}
        </span>
        <span className="col-start-1 row-start-2 flex items-center lg:col-start-5 lg:row-start-1">
          <OrderTrack order={order} />
        </span>
        <span className="col-start-2 row-start-2 justify-self-end lg:col-start-6 lg:row-start-1 lg:justify-self-start">
          <StatusBadge status={order.status} />
        </span>
      </Link>
    </li>
  );
}

function OrdersSkeleton() {
  return (
    <Loading label="Carregando os pedidos">
      <ul className="divide-y divide-line">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
            <Skeleton className="h-7 w-32 rounded-full" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}
