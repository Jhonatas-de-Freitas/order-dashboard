import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Moon, RotateCcw, Sun } from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import type { DemoBackend } from '../api/demo';
import { isAdmin, roleLabel } from '../auth/session';
import { useDemo, useSession, useUser } from '../auth/SessionContext';
import { useTheme } from '../lib/theme';
import { LiveOrders } from '../orders/LiveOrders';
import { ErrorBoundary } from './ErrorBoundary';
import { Logo } from './Logo';
import { Loading, Skeleton } from './states';
import { useToast } from './Toaster';

const NAVIGATION = [
  { to: '/', label: 'Loja', adminOnly: false },
  { to: '/pedidos', label: 'Pedidos', adminOnly: false },
  { to: '/indicadores', label: 'Indicadores', adminOnly: true },
  { to: '/estoque', label: 'Estoque', adminOnly: true },
];

export function AppShell() {
  const demo = useDemo();
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  // After a navigation, keyboard and screen reader users start from the new content.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <LiveOrders>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        {demo && <DemoStrip demo={demo} />}
        <Header />
        <main
          id="conteudo"
          ref={main}
          tabIndex={-1}
          className="wrap flex-1 py-6 outline-none sm:py-10"
        >
          <ErrorBoundary key={pathname}>
            <Suspense
              fallback={
                <Loading label="Carregando a tela">
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="mt-8 h-64" />
                </Loading>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="wrap py-6 text-sm text-ink-muted">
          Projeto de portfólio de Jhonatas de Freitas. O código está no{' '}
          <a
            href="https://github.com/Jhonatas-de-Freitas/order-dashboard"
            className="text-ink underline underline-offset-2"
          >
            GitHub
          </a>
          .
        </footer>
      </div>
    </LiveOrders>
  );
}

function Header() {
  const user = useUser();
  const { signOut } = useSession();
  const [theme, toggleTheme] = useTheme();

  return (
    <header className="band border-b border-band-line bg-band text-band-ink">
      <div className="wrap flex flex-wrap items-center gap-x-4 md:gap-x-8">
        <Link
          to="/"
          aria-label="Balcão, ir para a loja"
          className="flex h-14 items-center rounded-sm"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Principal"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] overflow-x-auto border-t border-band-line px-1 md:order-none md:mx-0 md:w-auto md:border-0 md:px-0"
        >
          {NAVIGATION.filter((item) => !item.adminOnly || isAdmin(user)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="type-narrow relative flex h-11 items-center px-3 text-base whitespace-nowrap text-band-muted -outline-offset-2 hover:text-band-ink aria-[current=page]:text-band-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-[3px] aria-[current=page]:after:bg-band-ink md:h-14"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            className="grid size-10 place-items-center rounded-md text-band-muted hover:text-band-ink"
          >
            {theme === 'dark' ? (
              <Sun aria-hidden className="size-5" />
            ) : (
              <Moon aria-hidden className="size-5" />
            )}
          </button>
          <p className="px-1 text-right leading-tight sm:px-2">
            <span className="block text-sm font-semibold">{user.name}</span>
            <span className="type-narrow block text-xs text-band-muted">{roleLabel(user)}</span>
          </p>
          <button
            type="button"
            onClick={signOut}
            className="type-narrow flex h-10 items-center gap-2 rounded-md px-2 text-band-muted hover:text-band-ink"
          >
            <LogOut aria-hidden className="size-5" />
            <span className="sr-only sm:not-sr-only">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function DemoStrip({ demo }: { demo: DemoBackend }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();

  const restart = () => {
    demo.restart();
    void queryClient.resetQueries();
    toast({
      title: 'Demonstração reiniciada',
      description: 'Os pedidos voltaram ao ponto de partida.',
    });
  };

  return (
    <aside aria-label="Demonstração" className="border-b border-line bg-sunken text-sm">
      <div className="wrap flex items-center gap-x-4 py-1.5">
        <p className="text-ink-muted">
          <strong className="type-narrow text-ink">Demonstração</strong>
          <span className="hidden md:inline">: tudo roda neste navegador, sem servidor.</span>
        </p>
        <div className="ml-auto flex items-center gap-1">
          <div
            role="radiogroup"
            aria-label="Ver como"
            className="flex rounded-md border border-line-strong bg-surface p-0.5"
          >
            {demo.session.personas.map((persona) => (
              <label key={persona.id} className="relative">
                <input
                  type="radio"
                  name="persona"
                  className="peer sr-only"
                  checked={user?.id === persona.id}
                  onChange={() => demo.session.signInAs(persona)}
                />
                <span className="type-narrow block cursor-pointer rounded-sm px-2.5 py-0.5 text-ink-muted peer-checked:bg-action peer-checked:text-action-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                  {isAdmin(persona) ? 'Admin' : `${persona.name.split(' ')[0]} (cliente)`}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={restart}
            className="type-narrow flex h-7 items-center gap-1.5 rounded-md px-2 text-ink-muted hover:text-ink"
          >
            <RotateCcw aria-hidden className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Recomeçar</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
