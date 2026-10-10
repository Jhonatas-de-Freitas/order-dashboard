import { Check, X } from 'lucide-react';
import { APPROVAL_LIMIT } from '../api/demo/payments';
import { formatMoney } from '../lib/format';

/** Tells the visitor which product leads to which ending. Only shown in the demo build. */
export function DemoScenarios() {
  return (
    <aside
      aria-labelledby="roteiro"
      className="rounded-lg border border-dashed border-line-strong px-5 py-4 sm:px-6"
    >
      <h2 id="roteiro" className="font-semibold">
        Três finais para testar
      </h2>
      <ul className="mt-2 grid gap-1.5 text-sm text-ink-muted">
        <li data-tone="confirmed" className="flex gap-2">
          <Check aria-hidden strokeWidth={3} className="mt-0.5 size-4 shrink-0 text-tone" />
          <span>
            <strong className="font-semibold text-ink">Teclado, Mouse, Monitor ou Webcam:</strong> o
            pedido é confirmado.
          </span>
        </li>
        <li data-tone="cancelled" className="flex gap-2">
          <X aria-hidden strokeWidth={3} className="mt-0.5 size-4 shrink-0 text-tone" />
          <span>
            <strong className="font-semibold text-ink">Headset USB:</strong> está sem saldo, o
            pedido é cancelado por falta de estoque.
          </span>
        </li>
        <li data-tone="cancelled" className="flex gap-2">
          <X aria-hidden strokeWidth={3} className="mt-0.5 size-4 shrink-0 text-tone" />
          <span>
            <strong className="font-semibold text-ink">Notebook Pro 16:</strong> passa de{' '}
            {formatMoney(APPROVAL_LIMIT)}, o pagamento é recusado.
          </span>
        </li>
      </ul>
    </aside>
  );
}
