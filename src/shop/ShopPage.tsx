import { useQuery } from '@tanstack/react-query';
import { Ban, Minus, PackageOpen, Plus } from 'lucide-react';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import type { Product } from '../api/types';
import { useDemo } from '../auth/SessionContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import { cx } from '../lib/cx';
import { formatCount, formatMoney } from '../lib/format';
import { MAX_QUANTITY, useCart } from './cart';
import { DemoScenarios } from './DemoScenarios';
import { OrderSlip } from './OrderSlip';
import { ProductIcon } from './ProductIcon';

// The row is laid out by the width of the catalog, not of the window: next to the order
// slip the catalog is narrow even on a wide screen. Stacked below 42rem, in columns above.
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-4 sm:px-6 @2xl:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_auto]';
const NAME = 'col-span-2 row-start-1 mb-3 flex items-center gap-3 @2xl:col-span-1 @2xl:mb-0';
const PRICE = 'col-start-1 row-start-2 @2xl:col-start-3 @2xl:row-start-1 @2xl:justify-self-end';
const STOCK = 'col-start-1 row-start-3 @2xl:col-start-2 @2xl:row-start-1';
const QUANTITY =
  'col-start-2 row-span-2 row-start-2 justify-self-end @2xl:col-start-4 @2xl:row-span-1 @2xl:row-start-1';

export function ShopPage() {
  const api = useApi();
  const demo = useDemo();
  const products = useQuery({ queryKey: keys.products, queryFn: () => api.listProducts() });

  return (
    <>
      <PageHeader
        title="Loja"
        description="Monte o pedido e finalize. O resto acontece sozinho: o estoque é reservado, o pagamento é cobrado e o pedido é confirmado."
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid grid-cols-1 gap-4">
          {demo && <DemoScenarios />}
          <Panel title="Catálogo" className="@container">
            {products.isPending ? (
              <CatalogSkeleton />
            ) : products.isError ? (
              <ErrorState error={products.error} onRetry={() => void products.refetch()} />
            ) : products.data.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="Nenhum produto no catálogo"
                action={<Button onClick={() => void products.refetch()}>Atualizar</Button>}
              >
                Assim que um produto for cadastrado, ele aparece aqui.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {products.data.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <OrderSlip products={products.data ?? []} />
      </div>
    </>
  );
}

function ProductRow({ product }: { product: Product }) {
  const { quantities, setQuantity } = useCart();
  const quantity = quantities.get(product.id) ?? 0;

  return (
    <li className={ROW}>
      <div className={NAME}>
        <ProductIcon productId={product.id} />
        <div className="min-w-0">
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm text-ink-muted">{product.description}</p>
        </div>
      </div>
      <p className={cx(PRICE, 'font-semibold tabular-nums')}>{formatMoney(product.price)}</p>
      <p className={cx(STOCK, 'text-sm')}>
        {product.availableQuantity > 0 ? (
          <span className="text-ink-muted">
            {formatCount(product.availableQuantity)} em estoque
          </span>
        ) : (
          <span
            data-tone="cancelled"
            className="type-narrow inline-flex items-center gap-1.5 text-tone"
          >
            <Ban aria-hidden className="size-3.5" />
            Sem saldo
          </span>
        )}
      </p>
      <div className={cx(QUANTITY, 'flex h-10 items-center rounded-md border border-line-strong')}>
        <button
          type="button"
          aria-label={`Diminuir ${product.name}`}
          disabled={quantity === 0}
          onClick={() => setQuantity(product.id, quantity - 1)}
          className="grid size-10 place-items-center rounded-l-md -outline-offset-2 hover:bg-sunken disabled:text-line-strong disabled:hover:bg-transparent"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <output
          aria-label={`Quantidade de ${product.name}`}
          className="w-8 text-center font-semibold tabular-nums"
        >
          {quantity}
        </output>
        <button
          type="button"
          aria-label={`Aumentar ${product.name}`}
          disabled={quantity >= MAX_QUANTITY}
          onClick={() => setQuantity(product.id, quantity + 1)}
          className="grid size-10 place-items-center rounded-r-md -outline-offset-2 hover:bg-sunken disabled:text-line-strong"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}

function CatalogSkeleton() {
  return (
    <Loading label="Carregando o catálogo">
      <ul className="divide-y divide-line">
        {Array.from({ length: 6 }, (_, index) => (
          // The same grid as a loaded row, so nothing moves when the catalog arrives.
          <li key={index} className={ROW}>
            <div className={NAME}>
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="mt-2 h-4 w-56 max-w-full" />
              </div>
            </div>
            <Skeleton className={cx(PRICE, 'my-0.5 h-5 w-24')} />
            <Skeleton className={cx(STOCK, 'my-0.5 h-4 w-20')} />
            <Skeleton className={cx(QUANTITY, 'h-10 w-[7.25rem]')} />
          </li>
        ))}
      </ul>
    </Loading>
  );
}
