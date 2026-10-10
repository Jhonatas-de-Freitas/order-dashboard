import { useQuery } from '@tanstack/react-query';
import { Ban, Minus, PackageOpen, Plus } from 'lucide-react';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import type { Product } from '../api/types';
import { useDemo } from '../auth/SessionContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import { formatCount, formatMoney } from '../lib/format';
import { MAX_QUANTITY, useCart } from './cart';
import { DemoScenarios } from './DemoScenarios';
import { OrderSlip } from './OrderSlip';
import { ProductIcon } from './ProductIcon';

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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-4">
          {demo && <DemoScenarios />}
          <section aria-labelledby="catalogo" className="sheet">
            <h2
              id="catalogo"
              className="type-narrow border-b border-line px-5 py-3 text-sm text-ink-muted sm:px-6"
            >
              Catálogo
            </h2>
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
          </section>
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
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_auto] sm:px-6">
      <div className="col-span-2 row-start-1 mb-3 flex items-center gap-3 sm:col-span-1 sm:mb-0">
        <ProductIcon productId={product.id} />
        <div className="min-w-0">
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm text-ink-muted">{product.description}</p>
        </div>
      </div>
      <p className="col-start-1 row-start-2 font-semibold tabular-nums sm:col-start-3 sm:row-start-1 sm:text-right">
        {formatMoney(product.price)}
      </p>
      <p className="col-start-1 row-start-3 text-sm sm:col-start-2 sm:row-start-1">
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
      <div className="col-start-2 row-span-2 row-start-2 flex h-10 items-center justify-self-end rounded-md border border-line-strong sm:col-start-4 sm:row-span-1 sm:row-start-1">
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
          // As tall as a loaded row, so the order slip below does not jump on small screens.
          <li
            key={index}
            className="flex min-h-32 items-start gap-4 px-5 py-4 sm:min-h-0 sm:items-center sm:px-6"
          >
            <Skeleton className="size-10 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-10 w-28 self-end sm:self-auto" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}
