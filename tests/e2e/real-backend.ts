import { createHash } from 'node:crypto';
import type { Page, Request } from '@playwright/test';

// The addresses the app uses when nothing else is configured, as in the system contract.
const REALM = 'http://localhost:8180/realms/store';
const OIDC = `${REALM}/protocol/openid-connect`;
const GATEWAY = 'http://localhost:8080';

export interface Account {
  sub: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
}

export const ana: Account = {
  sub: '5f0c2d7e-9a41-4c3b-8e21-6d2f1a9b7c10',
  username: 'ana',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  roles: ['customer'],
};

export const admin: Account = {
  sub: '8a1d4e6b-2c73-4f95-b0a8-3e5c7d9f1b24',
  username: 'admin',
  name: 'Admin Loja',
  email: 'admin@exemplo.com',
  roles: ['admin', 'customer'],
};

/** Switches the build under test to the real mode, the way the container does at start. */
export async function useRealMode(page: Page) {
  await page.route('**/config.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.__ENV__ = { VITE_DEMO_MODE: "false" };',
    }),
  );
}

const startingWith = (prefix: string) => (url: URL) => url.href.startsWith(prefix);

const jwt = (claims: object) =>
  [{ alg: 'RS256', typ: 'JWT' }, claims]
    .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
    .concat('signature')
    .join('.');

export interface Keycloak {
  /** Query string of each visit to the login page. */
  logins: URLSearchParams[];
  /** Form of each call to the token endpoint. */
  tokenRequests: URLSearchParams[];
  logouts: URLSearchParams[];
  /** Access tokens handed out, oldest first. */
  accessTokens: string[];
  /** When set, the refresh token is no longer accepted, as after the session expires. */
  sessionEnded: boolean;
}

/**
 * Stands in for the realm `store`: discovery, a login page that approves at once,
 * the token endpoint (checking the PKCE verifier against the challenge) and logout.
 */
export async function mockKeycloak(page: Page, account: Account = ana): Promise<Keycloak> {
  const keycloak: Keycloak = {
    logins: [],
    tokenRequests: [],
    logouts: [],
    accessTokens: [],
    sessionEnded: false,
  };
  let challenge: string | null = null;
  let refreshToken = '';

  const issueTokens = () => {
    const now = Math.floor(Date.now() / 1000);
    const serial = keycloak.accessTokens.length + 1;
    const identity = {
      iss: REALM,
      sub: account.sub,
      iat: now,
      exp: now + 300,
      name: account.name,
      preferred_username: account.username,
      email: account.email,
    };
    const accessToken = jwt({
      ...identity,
      jti: `access-${serial}`,
      aud: 'account',
      azp: 'store-web',
      realm_access: { roles: account.roles },
      scope: 'openid profile email',
    });
    keycloak.accessTokens.push(accessToken);
    refreshToken = `refresh-${serial}`;
    return {
      access_token: accessToken,
      expires_in: 300,
      refresh_expires_in: 1800,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      id_token: jwt({ ...identity, aud: 'store-web' }),
      'not-before-policy': 0,
      session_state: 'c2f8a1d0-7b3e-4a55-9c61-0e4d2b8f6a13',
      scope: 'openid profile email',
    };
  };

  const leaveTo = (address: string) => ({
    contentType: 'text/html',
    body: `<script>location.replace(${JSON.stringify(address)})</script>`,
  });

  await page.route(`${REALM}/.well-known/openid-configuration`, (route) =>
    route.fulfill({
      json: {
        issuer: REALM,
        authorization_endpoint: `${OIDC}/auth`,
        token_endpoint: `${OIDC}/token`,
        end_session_endpoint: `${OIDC}/logout`,
        jwks_uri: `${OIDC}/certs`,
        userinfo_endpoint: `${OIDC}/userinfo`,
        code_challenge_methods_supported: ['plain', 'S256'],
      },
    }),
  );

  await page.route(startingWith(`${OIDC}/auth`), (route) => {
    const query = new URL(route.request().url()).searchParams;
    keycloak.logins.push(query);
    challenge = query.get('code_challenge');
    const back = new URL(query.get('redirect_uri') ?? '');
    back.searchParams.set('state', query.get('state') ?? '');
    back.searchParams.set('code', 'code-1');
    return route.fulfill(leaveTo(back.href));
  });

  await page.route(`${OIDC}/token`, (route) => {
    const form = new URLSearchParams(route.request().postData() ?? '');
    keycloak.tokenRequests.push(form);
    const refused = (description: string) =>
      route.fulfill({
        status: 400,
        json: { error: 'invalid_grant', error_description: description },
      });

    if (form.get('grant_type') === 'authorization_code') {
      const verifier = form.get('code_verifier') ?? '';
      const expected = createHash('sha256').update(verifier).digest('base64url');
      if (form.get('code') !== 'code-1') return refused('Code not valid');
      if (expected !== challenge) return refused('PKCE verification failed');
    } else if (keycloak.sessionEnded || form.get('refresh_token') !== refreshToken) {
      return refused('Token is not active');
    }
    return route.fulfill({ json: issueTokens() });
  });

  await page.route(startingWith(`${OIDC}/logout`), (route) => {
    const query = new URL(route.request().url()).searchParams;
    keycloak.logouts.push(query);
    return route.fulfill(leaveTo(query.get('post_logout_redirect_uri') ?? ''));
  });

  return keycloak;
}

type Answer =
  { status?: number; json: unknown } | { status?: number; eventStream: string } | 'hang';
type Handler = (request: Request) => Answer | Promise<Answer>;

export const problem = (status: number, title: string, detail: string): Answer => ({
  status,
  json: { type: 'about:blank', title, status, detail, instance: '/api' },
});

export const pageOf = (content: unknown[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: content.length === 0 ? 0 : 1,
});

export interface Gateway {
  requests: { call: string; search: URLSearchParams; authorization: string | null }[];
  calls(call: string): number;
}

/**
 * Stands in for the api-gateway. `handlers` are keyed like `GET /api/orders`; anything
 * else answers 404, and the order stream stays open and quiet unless a test says otherwise.
 */
export async function mockGateway(page: Page, handlers: Record<string, Handler>): Promise<Gateway> {
  const gateway: Gateway = {
    requests: [],
    calls: (call) => gateway.requests.filter((request) => request.call === call).length,
  };
  const all: Record<string, Handler> = { 'GET /api/orders/stream': () => 'hang', ...handlers };

  await page.route(startingWith(`${GATEWAY}/`), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const call = `${request.method()} ${url.pathname}`;
    gateway.requests.push({
      call,
      search: url.searchParams,
      authorization: await request.headerValue('authorization'),
    });

    const answer = await (all[call] ?? (() => problem(404, 'Not Found', `No route for ${call}`)))(
      request,
    );
    if (answer === 'hang') return;
    if ('eventStream' in answer) {
      return route.fulfill({
        status: answer.status,
        contentType: 'text/event-stream',
        body: answer.eventStream,
      });
    }
    const status = answer.status ?? 200;
    return route.fulfill({
      status,
      contentType: status < 400 ? 'application/json' : 'application/problem+json',
      body: JSON.stringify(answer.json),
    });
  });

  return gateway;
}
