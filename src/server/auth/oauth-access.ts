import {OAUTH_ACCESS_TOKEN_PREFIX} from "@/shared/OAuth";

interface OAuthAccessTokenRow {
  clientId: string;
  disabled: number | boolean | null;
  expiresAt: Date | number | string;
  scopes: string | string[];
}

export interface OAuthAccessGrant {
  clientId: string;
  scopes: ReadonlySet<string>;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return base64Url(new Uint8Array(digest));
}

function timestampMs(value: OAuthAccessTokenRow["expiresAt"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  return Date.parse(value);
}

function parseScopes(value: OAuthAccessTokenRow["scopes"]): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((scope) =>
        typeof scope === "string")
      ? parsed
      : [];
  } catch {
    return value.split(" ").filter(Boolean);
  }
}

export async function verifyOAuthAccessToken(
  database: D1Database,
  credential: string,
): Promise<OAuthAccessGrant | null> {
  if (!credential.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) return null;
  const rawToken = credential.slice(OAUTH_ACCESS_TOKEN_PREFIX.length);
  if (!rawToken) return null;

  const row = await database.prepare(
    `SELECT
       access_token."clientId" AS "clientId",
       access_token."expiresAt" AS "expiresAt",
       access_token."scopes" AS "scopes",
       client."disabled" AS "disabled"
     FROM "oauth_access_token" AS access_token
     JOIN "oauth_client" AS client
       ON client."clientId" = access_token."clientId"
     WHERE access_token."token" = ?1
     LIMIT 1`,
  ).bind(await hashToken(rawToken)).first<OAuthAccessTokenRow>();

  if (!row || Boolean(row.disabled) || timestampMs(row.expiresAt) <= Date.now()) {
    return null;
  }
  return {
    clientId: row.clientId,
    scopes: new Set(parseScopes(row.scopes)),
  };
}
