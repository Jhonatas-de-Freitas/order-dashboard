import { useQuery } from '@tanstack/react-query';
import { ChartNoAxesColumn } from 'lucide-react';
import { Link } from 'react-router';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import type { StoreApi } from '../api/store-api';
import { buttonClass } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import {
  formatCount,
  formatDuration,
  formatMoney,
  formatPercent,
  formatTime,
  plural,
} from '../lib/format';
import { CANCELLATION, STATUS, type Tone } from '../orders/status';
import { lastLocalDays, revenueByLocalDay } from './revenue-days';
import { RevenueChart } from './RevenueChart';

const CHART_DAYS = 14;

async function loadIndicators(api: StoreApi) {
  const { days, from, to } = lastLocalDays(CHART_DAYS);
  const [summary, byStatus, revenue, cancellations, topProducts] = await Promise.all([
    api.getSummary(),
    api.getOrdersByStatus(),
    api.getRevenue({ from, to, granularity: 'hour' }),
    api.getCancellations(),
    api.getTopProducts(5),
  ]);
  return {
    summary,
    byStatus,
    revenueByDay: revenueByLocalDay(days, revenue),
    cancellations,
    topProducts,
  };
}

export function IndicatorsPage() {
  const api = useApi();
  const indicators = useQuery({
    queryKey: keys.indicators,
    queryFn: () => loadIndicators(api),
    // Analytics is fed by events on its own time; there is no stream to wait on.
    refetchInterval: 5000,
  });
  const lastEventAt = indicators.data?.summary.lastEventAt;

  return (
    <>
      <PageHeader
        title="Indicadores"
        description="Calculados a partir dos eventos de cada pedido, a cada 5 segundos."
      >
        {lastEventAt && (
          <p className="type-narrow text-sm text-ink-muted">
            Último evento às <time dateTime={lastEventAt}>{formatTime(lastEventAt)}</time>
          </p>
        )}
      </PageHeader>

      {indicators.isPending ? (
        <IndicatorsSkeleton />
      ) : indicators.isError ? (
        <div className="sheet">
          <ErrorState error={indicators.error} onRetry={() => void indicators.refetch()} />
        </div>
      ) : indicators.data.summary.totalOrders === 0 ? (
        <div className="sheet">
          <EmptyState
            icon={ChartNoAxesColumn}
            title="Ainda não há pedidos para resumir"
            action={
              <Link to="/" className={buttonClass('primary')}>
                Ir para a loja
              </Link>
            }
          >
            Os números aparecem aqui assim que o primeiro pedido for feito.
          </EmptyState>
        </div>
      ) : (
        <Indicators {...indicators.data} />
      )}
    </>
  );
}

function Indicators({
  summary,
  byStatus,
  revenueByDay,
  cancellations,
  topProducts,
}: Awaited<ReturnType<typeof loadIndicators>>) {
  const cancelled = cancellations.reduce((sum, { count }) => sum + count, 0);
  const mostSold = Math.max(...topProducts.map((product) => product.quantity), 1);

  return (
    <div className="grid gap-6">
      <dl className={FIGURES}>
        <Figure
          label="Total de pedidos"
          value={formatCount(summary.totalOrders)}
          hint={`${formatCount(summary.inProgress)} em andamento agora`}
        />
        <Figure
          label="Faturamento confirmado"
          value={formatMoney(summary.confirmedRevenue)}
          hint={plural(summary.confirmed, 'pedido confirmado', 'pedidos confirmados')}
        />
        <Figure
          label="Taxa de aprovação"
          value={formatPercent(summary.approvalRate)}
          hint={`${plural(summary.cancelled, 'cancelado', 'cancelados')} entre os concluídos`}
        />
        <Figure
          label="Tempo médio até confirmar"
          value={
            summary.averageSecondsToConfirm === null
              ? 'Sem dados'
              : formatDuration(summary.averageSecondsToConfirm)
          }
          hint="Do pedido feito à confirmação"
        />
      </dl>

      <Panel title={`Faturamento confirmado por dia, últimos ${revenueByDay.length} dias`}>
        {revenueByDay.some((day) => day.revenue > 0) ? (
          <div className="px-3 py-5 sm:px-6">
            <RevenueChart days={revenueByDay} />
          </div>
        ) : (
          <p className="px-5 py-4 text-ink-muted sm:px-6">
            Nenhuma venda confirmada nos últimos {revenueByDay.length} dias.
          </p>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Pedidos por estado">
          <BarList
            rows={byStatus.map(({ status, count }) => ({
              key: status,
              label: STATUS[status].label,
              value: formatCount(count),
              share: count / Math.max(summary.totalOrders, 1),
              tone: STATUS[status].tone,
            }))}
          />
        </Panel>
        <Panel title="Motivos de cancelamento">
          {cancellations.length === 0 ? (
            <p className="px-5 py-4 text-ink-muted sm:px-6">Nenhum pedido cancelado até agora.</p>
          ) : (
            <BarList
              rows={cancellations.map(({ reason, count }) => ({
                key: reason,
                label: CANCELLATION[reason],
                value: formatCount(count),
                share: count / cancelled,
                tone: 'cancelled',
              }))}
            />
          )}
        </Panel>
        <Panel title="Produtos mais vendidos" className="lg:col-span-2 xl:col-span-1">
          {topProducts.length === 0 ? (
            <p className="px-5 py-4 text-ink-muted sm:px-6">Nenhuma venda confirmada até agora.</p>
          ) : (
            <BarList
              rows={topProducts.map((product) => ({
                key: product.productId,
                label: product.productName,
                value: `${formatCount(product.quantity)} un.`,
                detail: formatMoney(product.revenue),
                share: product.quantity / mostSold,
                tone: 'neutral',
              }))}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

const FIGURES =
  'grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4';
const FIGURE = 'bg-surface px-5 py-4 sm:px-6 sm:py-5';

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={FIGURE}>
      <dt className="type-narrow text-sm text-ink-muted">{label}</dt>
      <dd className="type-wide mt-1 text-2xl xl:text-3xl">{value}</dd>
      <dd className="mt-0.5 text-sm text-ink-muted">{hint}</dd>
    </div>
  );
}

/** The four figures and the chart panel, in outline. */
function IndicatorsSkeleton() {
  return (
    <Loading label="Carregando os indicadores">
      <div className={FIGURES}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={FIGURE}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-8 w-24" />
            <Skeleton className="mt-2 h-4 w-40 max-w-full" />
          </div>
        ))}
      </div>
      <div className="sheet mt-6 px-5 py-5 sm:px-6">
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="mt-5 h-64" />
      </div>
    </Loading>
  );
}

interface BarRow {
  key: string;
  label: string;
  value: string;
  detail?: string;
  /** From 0 to 1: how much of the track this row fills. */
  share: number;
  tone: Tone;
}

function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="grid gap-4 px-5 py-4 sm:px-6">
      {rows.map((row) => (
        <li key={row.key} data-tone={row.tone}>
          <p className="flex items-baseline justify-between gap-3">
            <span>{row.label}</span>
            <span className="text-right whitespace-nowrap tabular-nums">
              <span className="font-semibold">{row.value}</span>
              {row.detail && <span className="ml-2 text-sm text-ink-muted">{row.detail}</span>}
            </span>
          </p>
          <span aria-hidden className="mt-1.5 block h-1.5 rounded-full bg-sunken">
            <span
              className="block h-full rounded-full bg-tone-solid transition-[width] duration-500 ease-settle"
              style={{ width: `${Math.round(row.share * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
