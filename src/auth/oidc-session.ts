import { UserManager, type User as OidcUser } from 'oidc-client-ts';
import type { AccessTokens } from '../api/gateway/gateway-api';
import type { Role, Session, User } from './session';

export interface OidcSettings {
  /** The realm, e.g. `http://localhost:8180/realms/store`. */
  authority: string;
  clientId: string;
  /** Where the app lives under the origin: `/` or `/order-dashboard/`. */
  basePath: string;
}

const ROLES: readonly Role[] = ['customer', 'admin'];

/**
 * Sign-in at Keycloak with the authorization code flow and PKCE. Resolves once it is
 * known who is signed in, so the first render already has the answer: either the
 * person is coming back from the login page, or the tab still holds a session.
 */
export async function startOidcSession({
  authority,
  clientId,
  basePath,
}: OidcSettings): Promise<Session & AccessTokens> {
  const appUrl = new URL(basePath, window.location.origin).href;
  const manager = new UserManager({
    authority,
    client_id: clientId,
    redirect_uri: appUrl,
    post_logout_redirect_uri: appUrl,
    scope: 'openid profile email',
    // With a refresh token the renewal is a plain request, no hidden iframe.
    automaticSilentRenew: true,
  });

  // Both are reassigned from the manager's events.
  let tokens = null as OidcUser | null;
  let user = null as User | null;
  const listeners = new Set<() => void>();

  const accept = (next: OidcUser | null) => {
    tokens = next;
    const nextUser = next && userOf(next);
    // A renewed token for the same person is not news for the screens.
    if (JSON.stringify(nextUser) === JSON.stringify(user)) return;
    user = nextUser;
    listeners.forEach((notify) => notify());
  };

  let renewal: Promise<string | null> | null = null;
  const renewAccessToken = () => {
    if (!tokens) return Promise.resolve(null);
    // Several requests may find out at once that the token ran out: one renewal for all.
    renewal ??= manager
      .signinSilent()
      .then(
        (renewed) => renewed?.access_token ?? null,
        () => null,
      )
      .finally(() => {
        renewal = null;
      });
    return renewal;
  };

  manager.events.addUserLoaded(accept);
  manager.events.addUserUnloaded(() => accept(null));

  const query = new URLSearchParams(window.location.search);
  if (query.has('state') && (query.has('code') || query.has('error'))) {
    let returnTo = '/';
    try {
      const signedIn = await manager.signinCallback();
      returnTo = (signedIn?.state as { returnTo?: string } | undefined)?.returnTo ?? '/';
    } catch {
      // A reloaded or refused callback: whoever was signed in before stays signed in.
      accept(await manager.getUser());
    }
    // The code was used; it should not stay in the address bar or in the history.
    window.history.replaceState(null, '', basePath.replace(/[/]$/, '') + returnTo);
  } else {
    accept(await manager.getUser());
  }

  if (tokens?.expired && !(await renewAccessToken())) await manager.removeUser();

  return {
    getUser: () => user,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: (returnTo = '/') => manager.signinRedirect({ state: { returnTo } }),
    signOut() {
      // Ends the session at Keycloak too. If it cannot be reached, at least this tab forgets.
      manager.signoutRedirect().catch(() => manager.removeUser());
    },
    accessToken: () =>
      tokens?.expired ? renewAccessToken() : Promise.resolve(tokens?.access_token ?? null),
    renewAccessToken,
  };
}

function userOf({ profile, access_token }: OidcUser): User {
  return {
    id: profile.sub,
    name: profile.name ?? profile.preferred_username ?? profile.sub,
    email: profile.email ?? '',
    roles: realmRolesIn(access_token),
  };
}

/**
 * Keycloak puts the realm roles in the access token, not in the ID token. Reading them
 * here only decides what the menu shows; the gateway is the one that checks the token.
 */
function realmRolesIn(accessToken: string): Role[] {
  try {
    const payload = accessToken.split('.')[1] ?? '';
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
      char.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      realm_access?: { roles?: string[] };
    };
    return ROLES.filter((role) => claims.realm_access?.roles?.includes(role));
  } catch {
    return [];
  }
}
