import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, PackageOpen } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import type { Product } from '../api/types';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Loading, Skeleton } from '../components/states';
import { useToast } from '../components/Toaster';
import { describeError } from '../lib/errors';
import { formatMoney } from '../lib/format';
import { ProductIcon } from '../shop/ProductIcon';

export function StockPage() {
  const api = useApi();
  const products = useQuery({ queryKey: keys.products, queryFn: () => api.listProducts() });

  return (
    <>
      <PageHeader
        title="Estoque"
        description="O saldo é o que a loja pode reservar. Um pedido com mais unidades do que o saldo é cancelado por falta de estoque."
      />
      <section aria-label="Produtos" className="sheet max-w-3xl">
        {products.isPending ? (
          <Loading label="Carregando os produtos">
            <ul className="divide-y divide-line">
              {Array.from({ length: 6 }, (_, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <span className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-md" />
                    <Skeleton className="h-5 w-44" />
                  </span>
                  <Skeleton className="h-10 w-40" />
                </li>
              ))}
            </ul>
          </Loading>
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => void products.refetch()} />
        ) : products.data.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="Nenhum produto cadastrado"
            action={<Button onClick={() => void products.refetch()}>Atualizar</Button>}
          >
            Quando houver produtos, o saldo de cada um é ajustado aqui.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {products.data.map((product) => (
              <StockRow key={product.id} product={product} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StockRow({ product }: { product: Product }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fieldId = useId();
  const [value, setValue] = useState(String(product.availableQuantity));

  // Orders move the stock while this screen is open; the field follows the server.
  const [known, setKnown] = useState(product.availableQuantity);
  if (known !== product.availableQuantity) {
    setKnown(product.availableQuantity);
    setValue(String(product.availableQuantity));
  }

  const quantity = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(quantity) && quantity >= 0;
  const changed = valid && quantity !== product.availableQuantity;

  const save = useMutation({
    mutationFn: () => api.setStock(product.id, quantity),
    onSuccess(saved) {
      toast({
        title: `Saldo de ${saved.name} salvo`,
        description: `Agora são ${saved.availableQuantity} em estoque.`,
        tone: 'confirmed',
      });
      return queryClient.invalidateQueries({ queryKey: keys.products });
    },
    onError(error) {
      const { title, message } = describeError(error);
      toast({ title, description: message, tone: 'cancelled' });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changed) save.mutate();
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-4">
        <ProductIcon productId={product.id} />
        <div className="min-w-0">
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm text-ink-muted">
            <span className="tabular-nums">{formatMoney(product.price)}</span>
            {product.availableQuantity === 0 && (
              <span
                data-tone="cancelled"
                className="type-narrow ml-3 inline-flex items-center gap-1 text-tone"
              >
                <Ban aria-hidden className="size-3.5" />
                Sem saldo
              </span>
            )}
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={fieldId} className="type-narrow text-sm text-ink-muted">
          Saldo<span className="sr-only"> de {product.name}</span>
        </label>
        <input
          id={fieldId}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={!valid}
          className="h-10 w-24 rounded-md border border-line-strong bg-surface px-3 text-right tabular-nums aria-invalid:border-tone-solid"
          data-tone={valid ? undefined : 'cancelled'}
        />
        <Button
          type="submit"
          variant={changed ? 'primary' : 'secondary'}
          disabled={!changed || save.isPending}
          aria-label={`Salvar saldo de ${product.name}`}
        >
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </li>
  );
}
