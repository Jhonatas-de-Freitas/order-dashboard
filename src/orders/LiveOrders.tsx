import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { useApi } from '../api/context';
import { keys } from '../api/keys';
import { isAdmin } from '../auth/session';
import { useUser } from '../auth/SessionContext';
import { orderCode } from '../lib/format';
import { STATUS } from './status';

const LiveContext = createContext({ connected: true });

export const useLive = () => use(LiveContext);

/** How often to refetch what the stream normally keeps fresh: never while it is up. */
export const usePollingFallback = () => (use(LiveContext).connected ? false : 5000);

/**
 * Listens to the order stream once for the whole app. Each event refetches whatever
 * is on screen about orders and is read out for screen readers.
 */
export function LiveOrders({ children }: { children: ReactNode }) {
  const api = useApi();
  const user = useUser();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  useEffect(
    () =>
      api.watchOrders({
        onUpdate(order) {
          void queryClient.invalidateQueries({ queryKey: keys.orders });
          void queryClient.invalidateQueries({ queryKey: keys.products });
          if (order.customerId === user.id || isAdmin(user)) {
            setAnnouncement(`Pedido ${orderCode(order.id)}: ${STATUS[order.status].label}`);
          }
        },
        onConnectionChange: setConnected,
      }),
    [api, queryClient, user],
  );

  return (
    <LiveContext value={{ connected }}>
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </LiveContext>
  );
}
