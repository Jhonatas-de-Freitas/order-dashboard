import { startTransition, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { startDemo } from './api/demo';
import { AppRoutes, Providers } from './App';
import { config } from './config';
import { browserStorage } from './lib/storage';
import './styles.css';

async function startBackend() {
  if (config.demoMode) {
    const demo = startDemo(browserStorage('session'));
    return { api: demo.api, session: demo.session, demo };
  }
  // Loaded on demand: the published demo never downloads the sign-in library.
  const { connectToGateway } = await import('./api/gateway');
  return { ...(await connectToGateway(config)), demo: undefined };
}

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

const { api, session, demo } = await startBackend();

const app = createRoot(root);
// As a transition the first render is done in slices, so the page answers while it loads.
startTransition(() =>
  app.render(
    <StrictMode>
      <Providers api={api} session={session} demo={demo}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
        </BrowserRouter>
      </Providers>
    </StrictMode>,
  ),
);
