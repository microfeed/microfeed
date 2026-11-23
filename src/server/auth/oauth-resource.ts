import {APIError} from "better-auth/api";
import {mcpResource} from "@/shared/Mcp";
import {MICROFEED_OAUTH_CLIENT_ID, OAUTH_ACCESS_TOKEN_PREFIX, OAUTH_REFRESH_TOKEN_PREFIX} from "@/shared/OAuth";

export interface OAuthResourceBinding {
  validated?: boolean;
  resource?: string | null;
}

export async function storedOAuthTokenHash(token: string, prefix: string): Promise<string | null> {
  if (!token.startsWith(prefix) || token.length === prefix.length) return null;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token.slice(prefix.length))));
  return btoa(String.fromCharCode(...digest)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export async function oauthBody(request: Pick<Request, "headers" | "json" | "formData">): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const value: unknown = await request.json().catch(() => null);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
  const form = await request.formData().catch(() => new FormData());
  return {...Object.fromEntries(form), ...(form.getAll("resource").length > 1 ? {resource: form.getAll("resource")} : {})};
}

function invalidTarget(): never {
  throw new APIError("BAD_REQUEST", {error: "invalid_target", error_description: "The requested resource does not match this authorization."});
}

export function normalizeOAuthResource(value: unknown, origin: string): string | null {
  if (value === undefined || value === null) return null;
  if (value === origin) return origin;
  if (value === mcpResource(origin) || value === `${origin}/mcp`) return mcpResource(origin);
  return invalidTarget();
}

export async function validateTokenResource(
  database: D1Database, request: Request, body: Record<string, unknown>,
  grantType: string, authorizedResource: unknown, mcpEnabled: boolean,
  binding: OAuthResourceBinding,
): Promise<void> {
  const origin = new URL(request.url).origin;
  const requested = normalizeOAuthResource(body.resource, origin);
  let authorized = normalizeOAuthResource(authorizedResource, origin);
  if (grantType === "refresh_token") {
    const hash = typeof body.refresh_token === "string"
      ? await storedOAuthTokenHash(body.refresh_token, OAUTH_REFRESH_TOKEN_PREFIX) : null;
    const row = hash ? await database.prepare(
      'SELECT resource FROM oauth_refresh_token WHERE token = ? LIMIT 1',
    ).bind(hash).first<{resource: string | null}>() : null;
    if (!row) return invalidTarget();
    authorized = row.resource;
  }
  if (requested !== authorized || (requested === mcpResource(origin) && !mcpEnabled)) return invalidTarget();
  binding.resource = authorized;
  binding.validated = true;
}

export async function bindOAuthResponse(database: D1Database, request: Request, response: Response, binding: OAuthResourceBinding): Promise<Response> {
  if (!response.ok) return response;
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/oauth2/register") {
    const data = await response.clone().json() as {client_id?: string};
    if (data.client_id && data.client_id !== MICROFEED_OAUTH_CLIENT_ID) {
      await database.prepare('UPDATE oauth_client SET requirePKCE = 1, skipConsent = 0 WHERE clientId = ?').bind(data.client_id).run();
    }
  }
  if (path !== "/api/auth/oauth2/token") return response;
  if (!binding.validated) throw new Error("OAuth resource was not validated before token issuance.");
  const data = await response.clone().json() as {access_token?: string; refresh_token?: string};
  const accessHash = data.access_token ? await storedOAuthTokenHash(data.access_token, OAUTH_ACCESS_TOKEN_PREFIX) : null;
  const refreshHash = data.refresh_token ? await storedOAuthTokenHash(data.refresh_token, OAUTH_REFRESH_TOKEN_PREFIX) : null;
  if (!accessHash) throw new Error("Expected an opaque OAuth access token.");
  const statements = [database.prepare('UPDATE oauth_access_token SET resource = ? WHERE token = ?').bind(binding.resource ?? null, accessHash)];
  if (refreshHash) statements.push(database.prepare('UPDATE oauth_refresh_token SET resource = ? WHERE token = ?').bind(binding.resource ?? null, refreshHash));
  const results = await database.batch(statements);
  if (results.some(result => result.meta.changes !== 1)) throw new Error("OAuth resource binding failed.");
  return response;
}
