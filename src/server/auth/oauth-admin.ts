import {MICROFEED_OAUTH_CLIENT_ID} from "@/shared/OAuth";
import type {
  OAuthClientSummary,
  OAuthConsentSummary,
} from "@/shared/OAuth";

interface OAuthClientRow {
  clientId: string;
  createdAt: Date | number | string | null;
  name: string | null;
  public: boolean | number | null;
  redirectUris: string | string[];
  scopes: string | string[] | null;
}

interface OAuthConsentRow {
  clientId: string;
  clientName: string | null;
  createdAt: Date | number | string;
  id: string;
  scopes: string | string[];
  updatedAt: Date | number | string;
}

function parseStringArray(value: string | string[] | null): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((entry) =>
        typeof entry === "string")
      ? parsed
      : [];
  } catch {
    return value.split(" ").filter(Boolean);
  }
}

function isoDate(value: Date | number | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date
    ? value
    : new Date(typeof value === "number" && value < 1_000_000_000_000
      ? value * 1000
      : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function listOAuthClients(
  database: D1Database,
  userId: string,
): Promise<OAuthClientSummary[]> {
  const rows = await database.prepare(
    `SELECT "clientId", "createdAt", "name", "public", "redirectUris", "scopes"
     FROM "oauth_client"
     WHERE "userId" = ?1
     ORDER BY "createdAt" DESC, "clientId" ASC`,
  ).bind(userId).all<OAuthClientRow>();
  return rows.results.map((row) => ({
    clientId: row.clientId,
    createdAt: isoDate(row.createdAt),
    name: row.name?.trim() || "Unnamed OAuth app",
    public: Boolean(row.public),
    redirectUris: parseStringArray(row.redirectUris),
    scopes: parseStringArray(row.scopes),
  }));
}

export async function getOAuthClientSummary(
  database: D1Database,
  clientId: string,
): Promise<OAuthClientSummary | null> {
  const row = await database.prepare(
    `SELECT "clientId", "createdAt", "name", "public", "redirectUris", "scopes"
     FROM "oauth_client"
     WHERE "clientId" = ?1 AND COALESCE("disabled", 0) = 0`,
  ).bind(clientId).first<OAuthClientRow>();
  return row
    ? {
        clientId: row.clientId,
        createdAt: isoDate(row.createdAt),
        name: row.name?.trim() || "Unnamed OAuth app",
        public: Boolean(row.public),
        redirectUris: parseStringArray(row.redirectUris),
        scopes: parseStringArray(row.scopes),
      }
    : null;
}

export async function listOAuthConsents(
  database: D1Database,
  userId: string,
): Promise<OAuthConsentSummary[]> {
  const rows = await database.prepare(
    `SELECT
       consent."id" AS "id",
       consent."clientId" AS "clientId",
       client."name" AS "clientName",
       consent."scopes" AS "scopes",
       consent."createdAt" AS "createdAt",
       consent."updatedAt" AS "updatedAt"
     FROM "oauth_consent" AS consent
     JOIN "oauth_client" AS client
       ON client."clientId" = consent."clientId"
     WHERE consent."userId" = ?1
     ORDER BY consent."updatedAt" DESC`,
  ).bind(userId).all<OAuthConsentRow>();
  return rows.results.map((row) => ({
    clientId: row.clientId,
    clientName: row.clientName?.trim() || row.clientId,
    createdAt: isoDate(row.createdAt) ?? "",
    id: row.id,
    scopes: parseStringArray(row.scopes),
    updatedAt: isoDate(row.updatedAt) ?? "",
  }));
}

export async function deleteOAuthClientAndTokens(
  database: D1Database,
  userId: string,
  clientId: string,
): Promise<boolean> {
  if (clientId === MICROFEED_OAUTH_CLIENT_ID) return false;
  const owned = await database.prepare(
    `SELECT "id" FROM "oauth_client"
     WHERE "clientId" = ?1 AND "userId" = ?2`,
  ).bind(clientId, userId).first<{id: string}>();
  if (!owned) return false;
  await database.batch([
    database.prepare(
      `DELETE FROM "oauth_access_token" WHERE "clientId" = ?1`,
    ).bind(clientId),
    database.prepare(
      `DELETE FROM "oauth_refresh_token" WHERE "clientId" = ?1`,
    ).bind(clientId),
    database.prepare(
      `DELETE FROM "oauth_consent" WHERE "clientId" = ?1`,
    ).bind(clientId),
    database.prepare(
      `DELETE FROM "oauth_client" WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(clientId, userId),
  ]);
  return true;
}

export async function revokeOAuthConsentAndTokens(
  database: D1Database,
  userId: string,
  consentId: string,
): Promise<boolean> {
  const consent = await database.prepare(
    `SELECT "clientId" FROM "oauth_consent"
     WHERE "id" = ?1 AND "userId" = ?2`,
  ).bind(consentId, userId).first<{clientId: string}>();
  if (!consent) return false;
  await database.batch([
    database.prepare(
      `DELETE FROM "oauth_access_token"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(consent.clientId, userId),
    database.prepare(
      `DELETE FROM "oauth_refresh_token"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(consent.clientId, userId),
    database.prepare(
      `DELETE FROM "oauth_consent" WHERE "id" = ?1 AND "userId" = ?2`,
    ).bind(consentId, userId),
  ]);
  return true;
}

export async function revokeAllOwnerOAuthCredentials(
  database: D1Database,
  userId: string,
): Promise<void> {
  await database.batch([
    database.prepare(
      `DELETE FROM "oauth_access_token" WHERE "userId" = ?1`,
    ).bind(userId),
    database.prepare(
      `DELETE FROM "oauth_refresh_token" WHERE "userId" = ?1`,
    ).bind(userId),
    database.prepare(
      `DELETE FROM "oauth_consent" WHERE "userId" = ?1`,
    ).bind(userId),
  ]);
}
