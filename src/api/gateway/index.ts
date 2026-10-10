import { startOidcSession } from '../../auth/oidc-session';
import type { Session } from '../../auth/session';
import type { Config } from '../../config';
import type { StoreApi } from '../store-api';
import { createGatewayApi } from './gateway-api';

export interface GatewayBackend {
  api: StoreApi;
  session: Session;
}

/** The real backend: sign-in at Keycloak, data through the api-gateway. */
export async function connectToGateway({ apiUrl, keycloak }: Config): Promise<GatewayBackend> {
  const session = await startOidcSession({
    authority: `${keycloak.url}/realms/${keycloak.realm}`,
    clientId: keycloak.clientId,
    basePath: import.meta.env.BASE_URL,
  });
  return { api: createGatewayApi(apiUrl, session), session };
}
