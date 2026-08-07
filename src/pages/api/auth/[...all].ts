import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {
  clearOAuthConnectionCookie,
  clearPasskeyStepUpCookie,
  createOAuthConnectionCookie,
  normalizeConnectionName,
  oauthConnectionHandoff,
  validConnectionId,
  validPasskeyStepUp,
} from "@/server/auth/account-security";
import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {
  revokeOAuthConnectionTokens,
  touchOAuthConnection,
  upsertOAuthConnection,
} from "@/server/auth/oauth-admin";
import {
  MICROFEED_OAUTH_CLIENT_ID,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
} from "@/shared/OAuth";

export const prerender = false;

export async function hasExactRegisteredRedirect(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/oauth2/authorize") return true;

  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) return true;

  const client = await env.FEED_DB.prepare(
    'SELECT "redirectUris" FROM "oauth_client" WHERE "clientId" = ? LIMIT 1',
  ).bind(clientId).first<{redirectUris: string}>();
  if (!client) return true;

  try {
    const registered = JSON.parse(client.redirectUris) as unknown;
    return Array.isArray(registered) && registered.includes(redirectUri);
  } catch {
    return false;
  }
}

function withCookie(response: Response, cookie: string): Response {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function oauthError(description: string): Response {
  return Response.json(
    {error: "invalid_request", error_description: description},
    {headers: {"cache-control": "no-store"}, status: 400},
  );
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function storedTokenHash(token: string, prefix: string): Promise<string | null> {
  if (!token.startsWith(prefix)) return null;
  const value = token.slice(prefix.length);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(digest));
}

interface ConnectionTokenReference {
  connectionId: string;
  userId: string;
}

async function officialConnectionRevocation(
  request: Request,
): Promise<ConnectionTokenReference | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/oauth2/revoke" || request.method !== "POST") {
    return null;
  }
  const contentType = request.headers.get("content-type") ?? "";
  let clientId: string | undefined;
  let token: string | undefined;
  if (contentType.includes("application/json")) {
    const body = await request.clone().json().catch(() => null) as {
      client_id?: unknown;
      token?: unknown;
    } | null;
    clientId = typeof body?.client_id === "string" ? body.client_id : undefined;
    token = typeof body?.token === "string" ? body.token : undefined;
  } else {
    const body = await request.clone().formData().catch(() => null);
    const bodyClientId = body?.get("client_id");
    const bodyToken = body?.get("token");
    clientId = typeof bodyClientId === "string" ? bodyClientId : undefined;
    token = typeof bodyToken === "string" ? bodyToken : undefined;
  }
  if (clientId !== MICROFEED_OAUTH_CLIENT_ID || !token) return null;
  const tokenHash = await storedTokenHash(token, OAUTH_REFRESH_TOKEN_PREFIX);
  if (!tokenHash) return null;
  const row = await env.FEED_DB.prepare(
    `SELECT "referenceId" AS "connectionId", "userId"
     FROM "oauth_refresh_token"
     WHERE "clientId" = ?1 AND "token" = ?2 AND "referenceId" IS NOT NULL
     LIMIT 1`,
  ).bind(MICROFEED_OAUTH_CLIENT_ID, tokenHash).first<ConnectionTokenReference>();
  return row ?? null;
}

async function touchConnectionFromTokenResponse(
  request: Request,
  response: Response,
): Promise<void> {
  if (new URL(request.url).pathname !== "/api/auth/oauth2/token" ||
      !response.ok) return;
  const body = await response.clone().json().catch(() => null) as {
    access_token?: unknown;
  } | null;
  if (typeof body?.access_token !== "string") return;
  const tokenHash = await storedTokenHash(
    body.access_token,
    OAUTH_ACCESS_TOKEN_PREFIX,
  );
  if (!tokenHash) return;
  const token = await env.FEED_DB.prepare(
    `SELECT "referenceId" FROM "oauth_access_token"
     WHERE "clientId" = ?1 AND "token" = ?2 AND "referenceId" IS NOT NULL
     LIMIT 1`,
  ).bind(
    MICROFEED_OAUTH_CLIENT_ID,
    tokenHash,
  ).first<{referenceId: string}>();
  if (token) await touchOAuthConnection(env.FEED_DB, token.referenceId);
}

async function requestWithOAuthConnection(
  request: Request,
): Promise<{cookie?: string; request: Request} | Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/oauth2/authorize" ||
      url.searchParams.get("client_id") !== MICROFEED_OAUTH_CLIENT_ID) {
    return {request};
  }
  const connectionId = url.searchParams.get("microfeed_connection_id");
  const connectionName = normalizeConnectionName(
    url.searchParams.get("microfeed_connection_name"),
  );
  if (!validConnectionId(connectionId) || !connectionName) {
    return oauthError(
      "microfeed CLI must provide a valid connection ID and a 1–64 character connection name.",
    );
  }
  url.searchParams.delete("microfeed_connection_id");
  url.searchParams.delete("microfeed_connection_name");
  const cookie = await createOAuthConnectionCookie(
    request,
    env.BETTER_AUTH_SECRET,
    {connectionId, connectionName},
  );
  const headers = new Headers(request.headers);
  const cookiePair = cookie.split(";", 1)[0]!;
  headers.set(
    "cookie",
    [headers.get("cookie"), cookiePair].filter(Boolean).join("; "),
  );
  return {
    cookie,
    request: new Request(url, {
      headers,
      method: request.method,
      redirect: request.redirect,
    }),
  };
}

async function passkeyStepUpError(
  request: Request,
  auth: ReturnType<typeof createMicrofeedAuth>,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (![
    "/api/auth/passkey/generate-register-options",
    "/api/auth/passkey/verify-registration",
    "/api/auth/passkey/delete-passkey",
  ].includes(path)) return null;

  const session = await auth.api.getSession({headers: request.headers});
  if (!session) {
    return Response.json(
      {code: "UNAUTHORIZED", message: "Sign in before changing passkeys."},
      {status: 401},
    );
  }
  let passkeyId: string | undefined;
  if (path.endsWith("/delete-passkey")) {
    const body = await request.clone().json().catch(() => null) as {
      id?: unknown;
    } | null;
    passkeyId = typeof body?.id === "string" ? body.id : undefined;
    if (!passkeyId) {
      return Response.json(
        {code: "BAD_REQUEST", message: "A passkey ID is required."},
        {status: 400},
      );
    }
  }
  const valid = await validPasskeyStepUp(
    request,
    env.BETTER_AUTH_SECRET,
    {
      action: passkeyId ? "delete" : "add",
      passkeyId,
      userId: session.user.id,
    },
  );
  return valid
    ? null
    : Response.json(
        {
          code: "PASSKEY_REAUTH_REQUIRED",
          message: "Confirm your current password before changing passkeys.",
        },
        {status: 403},
      );
}

export const ALL: APIRoute = async ({request: originalRequest}) => {
  const prepared = await requestWithOAuthConnection(originalRequest);
  if (prepared instanceof Response) return prepared;
  const request = prepared.request;
  if (!await hasExactRegisteredRedirect(request)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "The redirect_uri is not registered for this client.",
      },
      {
        headers: {"cache-control": "no-store"},
        status: 400,
      },
    );
  }
  const auth = createMicrofeedAuth(env, request);
  const passkeyError = await passkeyStepUpError(request, auth);
  if (passkeyError) return passkeyError;

  const connectionRevocation = await officialConnectionRevocation(request);

  const path = new URL(request.url).pathname;
  const handoff = path === "/api/auth/oauth2/consent"
    ? await oauthConnectionHandoff(request, env.BETTER_AUTH_SECRET)
    : null;
  let consentAccepted = false;
  if (handoff) {
    const body = await request.clone().json().catch(() => null) as {
      accept?: unknown;
    } | null;
    consentAccepted = body?.accept === true;
    const session = await auth.api.getSession({headers: request.headers});
    if (!session) return oauthError("The authorization session has expired.");
    const existing = await env.FEED_DB.prepare(
      `SELECT "userId", "clientId" FROM "oauth_connection"
       WHERE "id" = ?1 LIMIT 1`,
    ).bind(handoff.connectionId).first<{clientId: string; userId: string}>();
    if (existing && (existing.userId !== session.user.id ||
        existing.clientId !== MICROFEED_OAUTH_CLIENT_ID)) {
      return oauthError("The CLI connection ID belongs to another authorization.");
    }
  }

  let response = await auth.handler(request);
  if (connectionRevocation && response.ok) {
    await revokeOAuthConnectionTokens(
      env.FEED_DB,
      connectionRevocation.userId,
      MICROFEED_OAUTH_CLIENT_ID,
      connectionRevocation.connectionId,
    );
  }
  await touchConnectionFromTokenResponse(request, response);
  if (prepared.cookie) response = withCookie(response, prepared.cookie);

  if (handoff && path === "/api/auth/oauth2/consent") {
    if (consentAccepted && response.status < 400) {
      const consent = await env.FEED_DB.prepare(
        `SELECT "userId" FROM "oauth_consent"
         WHERE "clientId" = ?1 AND "referenceId" = ?2
         ORDER BY "updatedAt" DESC LIMIT 1`,
      ).bind(
        MICROFEED_OAUTH_CLIENT_ID,
        handoff.connectionId,
      ).first<{userId: string}>();
      if (consent) {
        await upsertOAuthConnection(env.FEED_DB, {
          clientId: MICROFEED_OAUTH_CLIENT_ID,
          connectionId: handoff.connectionId,
          connectionName: handoff.connectionName,
          userId: consent.userId,
        });
      }
    }
    response = withCookie(response, clearOAuthConnectionCookie(request));
  }

  if (response.status < 400 && [
    "/api/auth/passkey/verify-registration",
    "/api/auth/passkey/delete-passkey",
  ].includes(path)) {
    response = withCookie(response, clearPasskeyStepUpCookie(request));
  }
  return response;
};
