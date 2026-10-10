import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, plural } from '../lib/format';

export interface RevenueDay {
  /** `YYYY-MM-DD`, on the calendar of whoever is looking. */
  day: string;
  revenue: number;
  orders: number;
}

const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

const axisText = { fill: 'var(--ink-subtle)', fontSize: 12 };

export function RevenueChart({ days }: { days: RevenueDay[] }) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div>
      <div
        role="img"
        aria-label={`Faturamento confirmado por dia nos últimos ${days.length} dias. Os valores estão na tabela logo abaixo.`}
        className="h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              tick={axisText}
              tickLine={false}
              axisLine={{ stroke: 'var(--line-strong)' }}
              // Every nth day, evenly: dropping only the labels that collide leaves gaps.
              interval="equidistantPreserveEnd"
              minTickGap={8}
            />
            <YAxis
              width={64}
              tick={axisText}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => compactMoney.format(value)}
            />
            <Tooltip
              cursor={{ fill: 'var(--sunken)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const day = payload?.[0]?.payload as RevenueDay | undefined;
                if (!active || !day) return null;
                return (
                  <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-pop">
                    <p className="type-narrow text-ink-muted">{dayLabel(day.day)}</p>
                    <p className="font-semibold tabular-nums">{formatMoney(day.revenue)}</p>
                    <p className="text-ink-muted">
                      {plural(day.orders, 'pedido confirmado', 'pedidos confirmados')}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="revenue"
              fill="var(--confirmed-solid)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!reducedMotion}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="type-narrow w-fit rounded-sm text-ink-muted hover:text-ink">
          Ver os números em tabela
        </summary>
        <table className="mt-2 w-full max-w-md tabular-nums">
          <thead>
            <tr className="type-narrow border-b border-line text-left text-ink-muted">
              <th scope="col" className="py-1.5 font-[inherit]">
                Dia
              </th>
              <th scope="col" className="py-1.5 text-right font-[inherit]">
                Pedidos confirmados
              </th>
              <th scope="col" className="py-1.5 text-right font-[inherit]">
                Faturamento
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day} className="border-b border-line last:border-0">
                <td className="py-1.5">{dayLabel(day.day)}</td>
                <td className="py-1.5 text-right">{day.orders}</td>
                <td className="py-1.5 text-right">{formatMoney(day.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
