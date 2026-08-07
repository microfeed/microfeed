import {MICROFEED_OAUTH_CLIENT_ID} from "@/shared/OAuth";
import type {
  OAuthApplicationAccessSummary,
  OAuthClientSummary,
  OAuthConnectionSummary,
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

interface OAuthConnectionRow {
  active: number;
  clientId: string;
  clientName: string | null;
  connectedAt: Date | number | string;
  connectionId: string | null;
  connectionName: string | null;
  lastUsedAt: Date | number | string | null;
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

export async function listOAuthApplicationAccess(
  database: D1Database,
  userId: string,
): Promise<OAuthApplicationAccessSummary[]> {
  const rows = await database.prepare(
    `SELECT
       consent."clientId" AS "clientId",
       client."name" AS "clientName",
       consent."referenceId" AS "connectionId",
       connection."name" AS "connectionName",
       consent."scopes" AS "scopes",
       consent."createdAt" AS "connectedAt",
       consent."updatedAt" AS "updatedAt",
       COALESCE(
         connection."lastUsedAt",
         (SELECT MAX(token."createdAt") FROM "oauth_access_token" AS token
          WHERE token."clientId" = consent."clientId"
            AND token."userId" = consent."userId"
            AND (token."referenceId" = consent."referenceId"
              OR (token."referenceId" IS NULL AND consent."referenceId" IS NULL))),
         (SELECT MAX(token."createdAt") FROM "oauth_refresh_token" AS token
          WHERE token."clientId" = consent."clientId"
            AND token."userId" = consent."userId"
            AND (token."referenceId" = consent."referenceId"
              OR (token."referenceId" IS NULL AND consent."referenceId" IS NULL)))
       ) AS "lastUsedAt",
       CASE WHEN EXISTS (
         SELECT 1 FROM "oauth_access_token" AS access_token
         WHERE access_token."clientId" = consent."clientId"
           AND access_token."userId" = consent."userId"
           AND unixepoch(access_token."expiresAt") > unixepoch()
           AND (access_token."referenceId" = consent."referenceId"
             OR (access_token."referenceId" IS NULL AND consent."referenceId" IS NULL))
       ) OR EXISTS (
         SELECT 1 FROM "oauth_refresh_token" AS refresh_token
         WHERE refresh_token."clientId" = consent."clientId"
           AND refresh_token."userId" = consent."userId"
           AND unixepoch(refresh_token."expiresAt") > unixepoch()
           AND refresh_token."revoked" IS NULL
           AND (refresh_token."referenceId" = consent."referenceId"
             OR (refresh_token."referenceId" IS NULL AND consent."referenceId" IS NULL))
       ) THEN 1 ELSE 0 END AS "active"
     FROM "oauth_consent" AS consent
     JOIN "oauth_client" AS client
       ON client."clientId" = consent."clientId"
     LEFT JOIN "oauth_connection" AS connection
       ON connection."id" = consent."referenceId"
      AND connection."clientId" = consent."clientId"
      AND connection."userId" = consent."userId"
     WHERE consent."userId" = ?1
     ORDER BY client."name" ASC, consent."updatedAt" DESC`,
  ).bind(userId).all<OAuthConnectionRow>();

  const applications = new Map<string, OAuthApplicationAccessSummary>();
  for (const row of rows.results) {
    const application = applications.get(row.clientId) ?? {
      clientId: row.clientId,
      connections: [],
      name: row.clientName?.trim() || row.clientId,
    };
    const connection: OAuthConnectionSummary = {
      active: Boolean(row.active),
      connectedAt: isoDate(row.connectedAt) ?? "",
      id: row.connectionId,
      lastUsedAt: isoDate(row.lastUsedAt),
      legacy: !row.connectionId && row.clientId === MICROFEED_OAUTH_CLIENT_ID,
      name: row.connectionName?.trim() ||
        (row.clientId === MICROFEED_OAUTH_CLIENT_ID
          ? "Legacy CLI connection"
          : "Application authorization"),
      scopes: parseStringArray(row.scopes),
      updatedAt: isoDate(row.updatedAt) ?? "",
    };
    application.connections.push(connection);
    applications.set(row.clientId, application);
  }
  return [...applications.values()];
}

export async function upsertOAuthConnection(
  database: D1Database,
  input: {
    clientId: string;
    connectionId: string;
    connectionName: string;
    userId: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await database.prepare(
    `INSERT INTO "oauth_connection"
       ("id", "clientId", "userId", "name", "createdAt", "updatedAt")
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT("id") DO UPDATE SET
       "name" = excluded."name",
       "updatedAt" = excluded."updatedAt"
     WHERE "oauth_connection"."clientId" = excluded."clientId"
       AND "oauth_connection"."userId" = excluded."userId"`,
  ).bind(
    input.connectionId,
    input.clientId,
    input.userId,
    input.connectionName,
    now,
  ).run();
}

export async function touchOAuthConnection(
  database: D1Database,
  connectionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await database.prepare(
    `UPDATE "oauth_connection"
     SET "lastUsedAt" = ?1, "updatedAt" = ?1
     WHERE "id" = ?2`,
  ).bind(now, connectionId).run();
}

export async function revokeOAuthConnectionTokens(
  database: D1Database,
  userId: string,
  clientId: string,
  connectionId: string,
): Promise<void> {
  await database.batch([
    database.prepare(
      `DELETE FROM "oauth_access_token"
       WHERE "clientId" = ?1 AND "userId" = ?2 AND "referenceId" = ?3`,
    ).bind(clientId, userId, connectionId),
    database.prepare(
      `DELETE FROM "oauth_refresh_token"
       WHERE "clientId" = ?1 AND "userId" = ?2 AND "referenceId" = ?3`,
    ).bind(clientId, userId, connectionId),
  ]);
}

export async function revokeOAuthConnectionAndTokens(
  database: D1Database,
  userId: string,
  clientId: string,
  connectionId: string | null,
): Promise<boolean> {
  const referenceCondition = connectionId === null
    ? `"referenceId" IS NULL`
    : `"referenceId" = ?3`;
  const consent = await database.prepare(
    `SELECT "id" FROM "oauth_consent"
     WHERE "clientId" = ?1 AND "userId" = ?2
       AND ${referenceCondition}
     LIMIT 1`,
  ).bind(...(connectionId === null
    ? [clientId, userId]
    : [clientId, userId, connectionId])).first<{id: string}>();
  if (!consent) return false;

  const statement = (table: string) => database.prepare(
    `DELETE FROM "${table}"
     WHERE "clientId" = ?1 AND "userId" = ?2
       AND ${referenceCondition}`,
  ).bind(...(connectionId === null
    ? [clientId, userId]
    : [clientId, userId, connectionId]));
  const statements = [
    statement("oauth_access_token"),
    statement("oauth_refresh_token"),
    statement("oauth_consent"),
  ];
  if (connectionId !== null) {
    statements.push(database.prepare(
      `DELETE FROM "oauth_connection"
       WHERE "id" = ?1 AND "clientId" = ?2 AND "userId" = ?3`,
    ).bind(connectionId, clientId, userId));
  }
  await database.batch(statements);
  return true;
}

export async function revokeOAuthApplicationAccess(
  database: D1Database,
  userId: string,
  clientId: string,
): Promise<boolean> {
  const consent = await database.prepare(
    `SELECT "id" FROM "oauth_consent"
     WHERE "clientId" = ?1 AND "userId" = ?2 LIMIT 1`,
  ).bind(clientId, userId).first<{id: string}>();
  if (!consent) return false;
  await database.batch([
    database.prepare(
      `DELETE FROM "oauth_access_token"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(clientId, userId),
    database.prepare(
      `DELETE FROM "oauth_refresh_token"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(clientId, userId),
    database.prepare(
      `DELETE FROM "oauth_consent"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(clientId, userId),
    database.prepare(
      `DELETE FROM "oauth_connection"
       WHERE "clientId" = ?1 AND "userId" = ?2`,
    ).bind(clientId, userId),
  ]);
  return true;
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
    database.prepare(
      `DELETE FROM "oauth_connection" WHERE "userId" = ?1`,
    ).bind(userId),
  ]);
}
