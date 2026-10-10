import { createContext, use, useMemo, useState, type ReactNode } from 'react';

/** Same bounds POST /orders enforces. */
export const MAX_QUANTITY = 100;

interface Cart {
  /** Quantity by product id; a product that is not here is not in the cart. */
  quantities: ReadonlyMap<string, number>;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<Cart | null>(null);

export function useCart(): Cart {
  const cart = use(CartContext);
  if (!cart) throw new Error('useCart needs a CartProvider above it');
  return cart;
}

/** Kept above the routes, so the cart survives a look at the orders and back. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<ReadonlyMap<string, number>>(new Map());

  const cart = useMemo<Cart>(
    () => ({
      quantities,
      setQuantity: (productId, quantity) => {
        setQuantities((current) => {
          const next = new Map(current);
          if (quantity <= 0) next.delete(productId);
          else next.set(productId, Math.min(quantity, MAX_QUANTITY));
          return next;
        });
      },
      clear: () => setQuantities(new Map()),
    }),
    [quantities],
  );

  return <CartContext value={cart}>{children}</CartContext>;
}
