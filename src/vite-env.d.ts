/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
}

interface Window {
  /** Written by `config.js`, which the container generates from its environment. */
  __ENV__?: {
    readonly VITE_DEMO_MODE?: string;
    readonly VITE_API_URL?: string;
    readonly VITE_KEYCLOAK_URL?: string;
    readonly VITE_KEYCLOAK_REALM?: string;
    readonly VITE_KEYCLOAK_CLIENT_ID?: string;
  };
}
