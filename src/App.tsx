import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { ApiContext } from './api/context';
import type { DemoBackend } from './api/demo';
import { isApiError, type StoreApi } from './api/store-api';
import { NoAccessPage, NotFoundPage, SignInPage } from './auth/pages';
import { isAdmin, type Session } from './auth/session';
import { DemoContext, SessionContext, useSession, useUser } from './auth/SessionContext';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/Toaster';
import { OrderDetailPage } from './orders/OrderDetailPage';
import { OrdersPage } from './orders/OrdersPage';
import { CartProvider } from './shop/cart';
import { ShopPage } from './shop/ShopPage';
import { StockPage } from './stock/StockPage';

// The chart library is most of the bundle and only admins ever open this screen.
const IndicatorsPage = lazy(() =>
  import('./indicators/IndicatorsPage').then((module) => ({ default: module.IndicatorsPage })),
);

export function Providers({
  api,
  session,
  demo,
  children,
}: {
  api: StoreApi;
  session: Session;
  demo?: DemoBackend;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => {
    // The gateway no longer accepts the session: back to the sign-in screen.
    const onError = (error: Error) => {
      if (isApiError(error, 401)) session.signOut();
    };
    return new QueryClient({
      defaultOptions: {
        queries: {
          // An HTTP error is an answer; only a request that got no answer is worth repeating.
          retry: (failures, error) => failures < 1 && !isApiError(error),
        },
      },
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
    });
  });

  // What is cached belongs to whoever was signed in when it was fetched.
  useEffect(() => {
    let current = session.getUser()?.id;
    return session.subscribe(() => {
      const next = session.getUser()?.id;
      if (next === current) return;
      current = next;
      if (next) void queryClient.resetQueries();
      else queryClient.clear();
    });
  }, [session, queryClient]);

  return (
    <SessionContext value={session}>
      <DemoContext value={demo ?? null}>
        <ApiContext value={api}>
          <QueryClientProvider client={queryClient}>
            <Toaster>
              <CartProvider>{children}</CartProvider>
            </Toaster>
          </QueryClientProvider>
        </ApiContext>
      </DemoContext>
    </SessionContext>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/entrar" element={<SignInPage />} />
      <Route element={<SignedIn />}>
        <Route index element={<ShopPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="pedidos/:orderId" element={<OrderDetailPage />} />
        <Route element={<AdminOnly />}>
          <Route path="indicadores" element={<IndicatorsPage />} />
          <Route path="estoque" element={<StockPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function SignedIn() {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}

function AdminOnly() {
  return isAdmin(useUser()) ? <Outlet /> : <NoAccessPage />;
}
