import { ArrowRight, Lock, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { Button, buttonClass } from '../components/Button';
import { Logo } from '../components/Logo';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/states';
import { isAdmin, roleLabel } from './session';
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
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      <header className="band flex flex-col gap-8 bg-band px-6 py-8 text-band-ink sm:px-10 lg:justify-between lg:py-12">
        <Logo />
        <div>
          <p className="type-wide max-w-[18ch] text-2xl sm:text-4xl">
            Do pedido à confirmação, sem recarregar a página.
          </p>
          <p className="mt-3 max-w-[46ch] text-band-muted">
            O painel de uma loja fictícia. O estoque é reservado, o pagamento é cobrado e cada passo
            aparece na tela na hora em que acontece.
          </p>
          <ol className="mt-8 hidden gap-3 sm:grid">
            {JOURNEY.map(({ tone, label, detail }) => (
              <li key={label} data-tone={tone} className="flex items-baseline gap-3">
                <span className="size-2.5 shrink-0 rounded-full bg-tone-solid" />
                <span>
                  <span className="type-narrow">{label}</span>
                  <span className="text-band-muted"> {detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="hidden text-sm text-band-muted lg:block">
          Projeto de portfólio de Jhonatas de Freitas.
        </p>
      </header>

      <main className="grid place-items-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="type-wide text-2xl sm:text-3xl">Entrar</h1>
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
                    className="sheet group flex items-center justify-between gap-4 px-4 py-3 text-left hover:border-line-strong"
                  >
                    <span>
                      <span className="block font-semibold">{persona.name}</span>
                      <span className="block text-sm text-ink-muted">
                        {isAdmin(persona)
                          ? 'Administrador: vê todos os pedidos, os indicadores e o estoque.'
                          : 'Cliente: faz pedidos e acompanha os seus.'}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-5 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <StoreAccountSignIn onSignIn={() => signIn(cameFrom)} />
          )}
        </div>
      </main>
    </div>
  );
}

const JOURNEY = [
  { tone: 'received', label: 'Recebido.', detail: 'O pedido entra e a loja é avisada.' },
  {
    tone: 'reserved',
    label: 'Estoque reservado.',
    detail: 'Tudo ou nada, com o preço do catálogo.',
  },
  { tone: 'confirmed', label: 'Confirmado.', detail: 'Pagamento aprovado e cliente notificado.' },
] as const;

/** Sign-in happens on the identity provider's page; this only sends the person there. */
function StoreAccountSignIn({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'leaving' | 'unreachable'>('idle');

  const leave = () => {
    setState('leaving');
    // It only settles if the person is still here: the login failed to open, or they
    // came back to this page with the browser's back button.
    onSignIn().then(
      () => setState('idle'),
      () => setState('unreachable'),
    );
  };

  return (
    <>
      <p className="mt-1 text-ink-muted">Use a sua conta da loja para continuar.</p>
      {state === 'unreachable' && (
        <p role="alert" data-tone="cancelled" className="mt-4 text-sm text-tone">
          <strong className="font-semibold">O login não respondeu.</strong> Confira se o servidor de
          contas está no ar e tente de novo.
        </p>
      )}
      <Button
        variant="primary"
        className="mt-6 w-full"
        disabled={state === 'leaving'}
        onClick={leave}
      >
        {state === 'leaving' ? 'Abrindo o login…' : 'Entrar com a conta da loja'}
      </Button>
    </>
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
