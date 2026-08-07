import {env} from "cloudflare:workers";
import {hashPassword} from "better-auth/crypto";
import {oauthProviderAuthServerMetadata} from "@better-auth/oauth-provider";
import {beforeEach, describe, expect, it} from "vitest";

import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {decideApiRequest} from "@/server/api/access";
import {updateApiAccessSettings} from "@/server/api/api-keys";
import {
  deleteOAuthClientAndTokens,
  listOAuthClients,
  listOAuthConsents,
  revokeOAuthConsentAndTokens,
} from "@/server/auth/oauth-admin";
import {API_BASE_PATH} from "@/shared/ApiVersion";
import {OAUTH_ACCESS_TOKEN_PREFIX, OAUTH_REFRESH_TOKEN_PREFIX} from "@/shared/OAuth";
import {hasExactRegisteredRedirect} from "@/pages/api/auth/[...all]";

const ORIGIN = "https://feed.example.com";

async function seedOwner(): Promise<void> {
  const now = new Date().toISOString();
  const password = await hashPassword("correct horse battery staple");
  await env.FEED_DB.batch([
    env.FEED_DB.prepare('DELETE FROM "auth_rate_limit"'),
    env.FEED_DB.prepare('DELETE FROM "auth_session"'),
    env.FEED_DB.prepare('DELETE FROM "auth_account"'),
    env.FEED_DB.prepare('DELETE FROM "auth_user"'),
    env.FEED_DB.prepare(
      'INSERT INTO "auth_user" ' +
      '("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "role") ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "owner-id",
      "owner@example.com",
      "owner@example.com",
      1,
      now,
      now,
      "admin",
    ),
    env.FEED_DB.prepare(
      'INSERT INTO "auth_account" ' +
      '("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "account-id",
      "owner-id",
      "credential",
      "owner-id",
      password,
      now,
      now,
    ),
  ]);
}

function authRequest(
  pathname: string,
  init: RequestInit = {},
): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    ...init,
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      origin: ORIGIN,
      ...init.headers,
    },
  });
}

async function ownerCookie(): Promise<string> {
  const request = authRequest("/api/auth/sign-in/email", {
    body: JSON.stringify({
      email: "owner@example.com",
      password: "correct horse battery staple",
    }),
    headers: {"content-type": "application/json"},
    method: "POST",
  });
  const response = await createMicrofeedAuth(env, request).handler(request);
  return response.headers.get("set-cookie")!.split(";", 1)[0]!;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )));
}

async function authorize(
  cookie: string,
  options: {accept?: boolean; scope?: string; verifier?: string} = {},
): Promise<{code?: string; error?: string; state?: string}> {
  const verifier = options.verifier ?? "a".repeat(64);
  const state = "expected-state";
  const url = new URL("/api/auth/oauth2/authorize", ORIGIN);
  url.search = new URLSearchParams({
    client_id: "microfeed-cli",
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "consent",
    redirect_uri: "http://127.0.0.1:8977/callback",
    response_type: "code",
    scope: options.scope ?? "content:read offline_access",
    state,
  }).toString();
  const authorizationRequest = authRequest(`${url.pathname}${url.search}`, {
    headers: {cookie},
  });
  const authorization = await createMicrofeedAuth(env, authorizationRequest)
    .handler(authorizationRequest);
  expect(authorization.status).toBe(302);
  const consentUrl = new URL(authorization.headers.get("location")!, ORIGIN);
  expect(consentUrl.pathname).toBe("/admin/api/oauth/consent/");

  const consentRequest = authRequest("/api/auth/oauth2/consent", {
    body: JSON.stringify({
      accept: options.accept ?? true,
      oauth_query: consentUrl.search.slice(1),
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie,
    },
    method: "POST",
  });
  const consent = await createMicrofeedAuth(env, consentRequest)
    .handler(consentRequest);
  expect(consent.status).toBe(200);
  const callback = new URL((await consent.json() as {url: string}).url);
  return {
    code: callback.searchParams.get("code") ?? undefined,
    error: callback.searchParams.get("error") ?? undefined,
    state: callback.searchParams.get("state") ?? undefined,
  };
}

async function exchangeCode(code: string, verifier = "a".repeat(64)) {
  const request = authRequest("/api/auth/oauth2/token", {
    body: new URLSearchParams({
      client_id: "microfeed-cli",
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: "http://127.0.0.1:8977/callback",
    }),
    headers: {"content-type": "application/x-www-form-urlencoded"},
    method: "POST",
  });
  return await createMicrofeedAuth(env, request).handler(request);
}

beforeEach(seedOwner);

describe("Better Auth on Workers with D1", () => {
  it("publishes same-origin OAuth discovery without operator or credential data", async () => {
    const request = authRequest(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    const response = await oauthProviderAuthServerMetadata(
      createMicrofeedAuth(env, request),
    )(request);
    expect(response.status).toBe(200);
    const metadata = await response.json() as Record<string, unknown>;
    expect(metadata).toMatchObject({
      authorization_endpoint: `${ORIGIN}/api/auth/oauth2/authorize`,
      code_challenge_methods_supported: ["S256"],
      issuer: `${ORIGIN}/api/auth`,
      token_endpoint: `${ORIGIN}/api/auth/oauth2/token`,
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /owner@example|BETTER_AUTH_SECRET|instanceId|accountId/iu,
    );
  });

  it("requires an exact registered OAuth redirect URL", async () => {
    const exact = authRequest(
      "/api/auth/oauth2/authorize?client_id=microfeed-cli&" +
      "redirect_uri=http%3A%2F%2F127.0.0.1%3A8977%2Fcallback",
    );
    const changedPort = authRequest(
      "/api/auth/oauth2/authorize?client_id=microfeed-cli&" +
      "redirect_uri=http%3A%2F%2F127.0.0.1%3A8978%2Fcallback",
    );
    expect(await hasExactRegisteredRedirect(exact)).toBe(true);
    expect(await hasExactRegisteredRedirect(changedPort)).toBe(false);
  });

  it("signs in, reads a revocable D1 session, and signs out", async () => {
    const signInRequest = authRequest("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: "owner@example.com",
        password: "correct horse battery staple",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signIn = await createMicrofeedAuth(
      env,
      signInRequest,
    ).handler(signInRequest);
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toContain("microfeed.session_token=");

    const sessionRequest = authRequest("/api/auth/get-session", {
      headers: {cookie: cookie!},
    });
    const session = await createMicrofeedAuth(
      env,
      sessionRequest,
    ).handler(sessionRequest);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: {
        email: "owner@example.com",
        role: "admin",
      },
    });

    const signOutRequest = authRequest("/api/auth/sign-out", {
      body: "{}",
      headers: {
        "content-type": "application/json",
        cookie: cookie!,
      },
      method: "POST",
    });
    const signOut = await createMicrofeedAuth(
      env,
      signOutRequest,
    ).handler(signOutRequest);
    expect(signOut.status).toBe(200);

    const remaining = await env.FEED_DB.prepare(
      'SELECT COUNT(*) AS "count" FROM "auth_session"',
    ).first<{count: number}>();
    expect(remaining?.count).toBe(0);
  });

  it("rejects public signup and invalid credentials", async () => {
    const signUpRequest = authRequest("/api/auth/sign-up/email", {
      body: JSON.stringify({
        email: "someone@example.com",
        name: "Someone",
        password: "another private password",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signUp = await createMicrofeedAuth(
      env,
      signUpRequest,
    ).handler(signUpRequest);
    expect(signUp.ok).toBe(false);

    const signInRequest = authRequest("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: "owner@example.com",
        password: "not the right password",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signIn = await createMicrofeedAuth(
      env,
      signInRequest,
    ).handler(signInRequest);
    expect(signIn.ok).toBe(false);
    expect(await signIn.text()).not.toContain("owner@example.com");
  });

  it("continues an authorization request through administrator login", async () => {
    const verifier = "a".repeat(64);
    const query = new URLSearchParams({
      client_id: "microfeed-cli",
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
      redirect_uri: "http://127.0.0.1:8977/callback",
      response_type: "code",
      scope: "content:read offline_access",
      state: "login-state",
    });
    const authorizationRequest = authRequest(
      `/api/auth/oauth2/authorize?${query}`,
    );
    const authorization = await createMicrofeedAuth(env, authorizationRequest)
      .handler(authorizationRequest);
    expect(authorization.status).toBe(302);
    const loginUrl = new URL(authorization.headers.get("location")!, ORIGIN);
    expect(loginUrl.pathname).toBe("/admin/login/");
    expect(loginUrl.searchParams.get("sig")).toBeTruthy();

    const signInRequest = authRequest("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: "owner@example.com",
        oauth_query: loginUrl.search.slice(1),
        password: "correct horse battery staple",
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const signIn = await createMicrofeedAuth(env, signInRequest)
      .handler(signInRequest);
    expect(signIn.status).toBe(200);
    const consentUrl = new URL((await signIn.json() as {url: string}).url, ORIGIN);
    expect(consentUrl.pathname).toBe("/admin/api/oauth/consent/");
    expect(consentUrl.searchParams.get("state")).toBe("login-state");
  });

  it("approves and denies the official CLI with signed consent and S256 PKCE", async () => {
    const cookie = await ownerCookie();
    const denied = await authorize(cookie, {accept: false});
    expect(denied).toMatchObject({
      error: "access_denied",
      state: "expected-state",
    });

    const approved = await authorize(cookie);
    expect(approved.state).toBe("expected-state");
    const tokenResponse = await exchangeCode(approved.code!);
    expect(tokenResponse.status).toBe(200);
    const tokens = await tokenResponse.json() as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    };
    expect(tokens.access_token).toMatch(new RegExp(`^${OAUTH_ACCESS_TOKEN_PREFIX}`));
    expect(tokens.refresh_token).toMatch(new RegExp(`^${OAUTH_REFRESH_TOKEN_PREFIX}`));
    expect(tokens.expires_in).toBe(3600);
    expect(tokens.scope.split(" ")).toEqual(["content:read", "offline_access"]);

    const second = await authorize(cookie);
    const badVerifier = await exchangeCode(second.code!, "b".repeat(64));
    expect(badVerifier.ok).toBe(false);
    expect(await badVerifier.text()).not.toContain(second.code!);
  });

  it("enforces OAuth scopes, expiry, refresh rotation, and immediate revocation", async () => {
    const cookie = await ownerCookie();
    const approved = await authorize(cookie);
    const tokenResponse = await exchangeCode(approved.code!);
    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
    };
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    const readRequest = authRequest(`${API_BASE_PATH}feed/`, {
      headers: {authorization: `Bearer ${tokens.access_token}`},
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      readRequest,
      `${API_BASE_PATH}feed/`,
      "built-in",
    )).toBe("allow-integration");
    const writeRequest = authRequest(`${API_BASE_PATH}items/`, {
      headers: {authorization: `Bearer ${tokens.access_token}`},
      method: "POST",
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      writeRequest,
      `${API_BASE_PATH}items/`,
      "built-in",
    )).toBe("insufficient-scope");
    await env.FEED_DB.prepare(
      'UPDATE "oauth_access_token" SET "expiresAt" = ? WHERE "userId" = ?',
    ).bind(new Date(Date.now() - 60_000).toISOString(), "owner-id").run();
    expect(await decideApiRequest(
      env.FEED_DB,
      readRequest,
      `${API_BASE_PATH}feed/`,
      "built-in",
    )).toBe("unauthorized");

    const refreshRequest = authRequest("/api/auth/oauth2/token", {
      body: new URLSearchParams({
        client_id: "microfeed-cli",
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
      headers: {"content-type": "application/x-www-form-urlencoded"},
      method: "POST",
    });
    const refreshed = await createMicrofeedAuth(env, refreshRequest)
      .handler(refreshRequest);
    expect(refreshed.status).toBe(200);
    const rotated = await refreshed.json() as {
      access_token: string;
      refresh_token: string;
    };
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);

    const revokeRequest = authRequest("/api/auth/oauth2/revoke", {
      body: new URLSearchParams({
        client_id: "microfeed-cli",
        token: rotated.refresh_token,
        token_type_hint: "refresh_token",
      }),
      headers: {"content-type": "application/x-www-form-urlencoded"},
      method: "POST",
    });
    expect((await createMicrofeedAuth(env, revokeRequest).handler(revokeRequest)).ok)
      .toBe(true);
    const revokedRequest = authRequest(`${API_BASE_PATH}feed/`, {
      headers: {authorization: `Bearer ${rotated.access_token}`},
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      revokedRequest,
      `${API_BASE_PATH}feed/`,
      "built-in",
    )).toBe("unauthorized");

    const replayRequest = authRequest("/api/auth/oauth2/token", {
      body: new URLSearchParams({
        client_id: "microfeed-cli",
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
      headers: {"content-type": "application/x-www-form-urlencoded"},
      method: "POST",
    });
    expect((await createMicrofeedAuth(env, replayRequest).handler(replayRequest)).ok)
      .toBe(false);
  });

  it("revokes grants and owner-registered clients immediately", async () => {
    const cookie = await ownerCookie();
    const approved = await authorize(cookie, {scope: "content:read"});
    const tokens = await (await exchangeCode(approved.code!)).json() as {
      access_token: string;
    };
    const [consent] = await listOAuthConsents(env.FEED_DB, "owner-id");
    expect(consent?.clientId).toBe("microfeed-cli");
    expect(await revokeOAuthConsentAndTokens(
      env.FEED_DB,
      "owner-id",
      consent!.id,
    )).toBe(true);
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    const requestWithRevokedToken = authRequest(`${API_BASE_PATH}feed/`, {
      headers: {authorization: `Bearer ${tokens.access_token}`},
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      requestWithRevokedToken,
      `${API_BASE_PATH}feed/`,
      "built-in",
    )).toBe("unauthorized");

    const createRequest = authRequest("/api/auth/oauth2/create-client", {
      body: JSON.stringify({
        client_name: "Example app",
        redirect_uris: ["https://app.example/callback"],
        scope: "content:read",
        token_endpoint_auth_method: "client_secret_basic",
        type: "web",
      }),
      headers: {"content-type": "application/json", cookie},
      method: "POST",
    });
    const createdResponse = await createMicrofeedAuth(env, createRequest)
      .handler(createRequest);
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json() as {
      client_id: string;
      client_secret: string;
    };
    expect(created.client_secret).toMatch(/^mf_ocs_/u);
    expect((await listOAuthClients(env.FEED_DB, "owner-id"))[0])
      .toMatchObject({clientId: created.client_id, name: "Example app"});
    expect(await deleteOAuthClientAndTokens(
      env.FEED_DB,
      "owner-id",
      created.client_id,
    )).toBe(true);
    expect(await listOAuthClients(env.FEED_DB, "owner-id")).toEqual([]);
  });
});
