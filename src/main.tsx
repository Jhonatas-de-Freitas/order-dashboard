import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { startDemo } from './api/demo';
import { AppRoutes, Providers } from './App';
import { config } from './config';
import { browserStorage } from './lib/storage';
import './styles.css';

if (!config.demoMode) {
  throw new Error('Only the demo mode exists so far. Build without VITE_DEMO_MODE=false.');
}

const demo = startDemo(browserStorage('session'));
const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <Providers api={demo.api} session={demo.session} demo={demo}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
