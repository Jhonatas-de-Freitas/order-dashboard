import { Lock, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { Button, buttonClass } from '../components/Button';
import { Logo } from '../components/Logo';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/states';
import { roleLabel } from './session';
import { useDemo, useSession, useUser } from './SessionContext';

export function SignInPage() {
  const { user, signIn } = useSession();
  const demo = useDemo();
  const location = useLocation();
  const cameFrom = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    document.title = 'Entrar | Balcão';
  }, []);

  if (user) return <Navigate to={cameFrom} replace />;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="sheet w-full max-w-sm p-6 sm:p-8">
        <Logo />
        <h1 className="type-wide mt-8 text-2xl">Entrar</h1>
        {demo ? (
          <>
            <p className="mt-1 text-ink-muted">
              Na demonstração não há senha. Escolha com quem quer ver o painel.
            </p>
            <div className="mt-6 grid gap-3">
              {demo.session.personas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => demo.session.signInAs(persona)}
                  className="rounded-md border border-line-strong px-4 py-3 text-left hover:bg-sunken"
                >
                  <span className="block font-semibold">{persona.name}</span>
                  <span className="type-narrow block text-sm text-ink-muted">
                    {roleLabel(persona)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-ink-muted">Use a sua conta da loja para continuar.</p>
            <Button variant="primary" className="mt-6 w-full" onClick={signIn}>
              Entrar com a conta da loja
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

export function NoAccessPage() {
  const user = useUser();
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Sem acesso" />
      <div className="sheet">
        <EmptyState
          icon={Lock}
          title="Esta área é só para administradores"
          action={
            <Link to="/" className={buttonClass()}>
              Voltar para a loja
            </Link>
          }
        >
          Você entrou como {user.name} ({roleLabel(user).toLowerCase()}).
          {demo && ' Na demonstração, troque para Admin no topo da página.'}
        </EmptyState>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página não encontrada" />
      <div className="sheet">
        <EmptyState
          icon={SearchX}
          title="Este endereço não leva a lugar nenhum"
          action={
            <Link to="/" className={buttonClass()}>
              Ir para a loja
            </Link>
          }
        >
          Confira o endereço ou volte para a loja.
        </EmptyState>
      </div>
    </>
  );
}
