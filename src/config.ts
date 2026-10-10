/**
 * Settings come from two places. `config.js` is loaded by index.html before the app and
 * is rewritten when the container starts, so one image serves any environment. The
 * `VITE_*` variables of the build are the fallback, which is what `npm run dev` uses.
 */
const runtime = window.__ENV__ ?? {};
const env = import.meta.env;

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const config = {
  /** Backend simulated in the browser. On unless told `VITE_DEMO_MODE=false`. */
  demoMode: (runtime.VITE_DEMO_MODE || env.VITE_DEMO_MODE) !== 'false',
  apiUrl: withoutTrailingSlash(runtime.VITE_API_URL || env.VITE_API_URL || 'http://localhost:8080'),
  keycloak: {
    url: withoutTrailingSlash(
      runtime.VITE_KEYCLOAK_URL || env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
    ),
    realm: runtime.VITE_KEYCLOAK_REALM || env.VITE_KEYCLOAK_REALM || 'store',
    clientId: runtime.VITE_KEYCLOAK_CLIENT_ID || env.VITE_KEYCLOAK_CLIENT_ID || 'store-web',
  },
};

export type Config = typeof config;
