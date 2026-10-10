import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../api/context';
import type { Product } from '../api/types';
import { useUser } from '../auth/SessionContext';
import { Button } from '../components/Button';
import { useToast } from '../components/Toaster';
import { describeError } from '../lib/errors';
import { formatMoney, orderCode, plural } from '../lib/format';
import { useCart } from './cart';

/** The cart, drawn as the paper slip a counter clerk would hand over. */
export function OrderSlip({ products }: { products: Product[] }) {
  const api = useApi();
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const { quantities, clear } = useCart();

  const lines = products.flatMap((product) => {
    const quantity = quantities.get(product.id);
    return quantity ? [{ product, quantity, subtotal: product.price * quantity }] : [];
  });
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  const order = useMutation({
    mutationFn: () =>
      api.placeOrder({
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      }),
    onSuccess(placed) {
      clear();
      toast({
        title: `Pedido ${orderCode(placed.id)} recebido`,
        description: 'Acompanhe aqui: o estado muda sozinho.',
        tone: 'received',
      });
      void navigate('/pedidos', { state: { placed: placed.id } });
    },
  });
  const failure = order.isError ? describeError(order.error) : null;

  const slip = useRef<HTMLElement>(null);
  const slipInView = useInView(slip);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section ref={slip} aria-labelledby="pedido" className="lg:sticky lg:top-6">
      <div className="slip-shadow">
        <div className="slip bg-surface px-5 pt-5 pb-8 sm:px-6 dark:bg-sunken">
          <h2 id="pedido" className="type-wide text-xl">
            Seu pedido
          </h2>
          <p className="text-sm text-ink-muted">Em nome de {user.name}</p>

          {lines.length === 0 ? (
            <p className="mt-5 border-t border-dashed border-line-strong pt-4 text-ink-muted">
              Nenhum item ainda. Use os botões do catálogo para somar produtos.
            </p>
          ) : (
            <ul className="mt-5 grid gap-2 border-t border-dashed border-line-strong pt-4">
              {lines.map(({ product, quantity, subtotal }) => (
                <li key={product.id} className="flex items-baseline">
                  <span>
                    <span className="tabular-nums">{quantity} ×</span> {product.name}
                  </span>
                  <span aria-hidden className="leader" />
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-baseline justify-between border-t border-dashed border-line-strong pt-3">
            <span className="type-narrow text-ink-muted">Total</span>
            <strong className="type-wide text-2xl tabular-nums">{formatMoney(total)}</strong>
          </p>

          {failure && (
            <p role="alert" data-tone="cancelled" className="mt-3 text-sm text-tone">
              <strong className="font-semibold">{failure.title}.</strong> {failure.message}
            </p>
          )}

          <Button
            variant="primary"
            className="mt-4 w-full"
            disabled={lines.length === 0 || order.isPending}
            onClick={() => order.mutate()}
          >
            {order.isPending ? 'Enviando pedido…' : 'Finalizar pedido'}
          </Button>
          {lines.length > 0 && (
            <Button variant="quiet" size="sm" className="mt-2 w-full" onClick={clear}>
              Esvaziar
            </Button>
          )}
        </div>
      </div>

      {/* Outside the shadow wrapper: its filter would capture a fixed child. */}
      {itemCount > 0 && !slipInView && (
        <div className="band fixed inset-x-0 bottom-0 z-40 border-t border-band-line bg-band text-band-ink lg:hidden">
          <div className="wrap flex items-center justify-between gap-4 py-3">
            <p className="leading-tight">
              <span className="type-narrow block text-sm text-band-muted">
                {plural(itemCount, 'item', 'itens')}
              </span>
              <strong className="tabular-nums">{formatMoney(total)}</strong>
            </p>
            <button
              type="button"
              onClick={() => slip.current?.scrollIntoView({ block: 'start' })}
              className="type-narrow h-10 rounded-md bg-band-ink px-4 text-band"
            >
              Ver pedido
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** On small screens the slip sits below the catalog; this tells when it is out of sight. */
function useInView(target: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? true),
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [target]);
  return inView;
}
