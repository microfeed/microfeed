import {getAuthenticatorName} from "@better-auth/passkey";
import type {
  AccountPasskeySummary,
  AccountSessionSummary,
} from "@/shared/Account";

interface SessionRow {
  createdAt: Date | string;
  expiresAt: Date | string;
  id: string;
  ipAddress: string | null;
  updatedAt: Date | string;
  userAgent: string | null;
}

interface PasskeyRow {
  aaguid: string | null;
  backedUp: boolean | number;
  createdAt: Date | string | null;
  deviceType: string;
  id: string;
  name: string | null;
}

function isoDate(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function listAccountSessions(
  database: D1Database,
  userId: string,
  currentSessionId?: string,
): Promise<AccountSessionSummary[]> {
  const rows = await database.prepare(
    `SELECT "id", "createdAt", "updatedAt", "expiresAt", "ipAddress", "userAgent"
     FROM "auth_session"
     WHERE "userId" = ?1 AND unixepoch("expiresAt") > unixepoch()
     ORDER BY CASE WHEN "id" = ?2 THEN 0 ELSE 1 END,
       "updatedAt" DESC, "createdAt" DESC`,
  ).bind(userId, currentSessionId ?? "").all<SessionRow>();
  return rows.results.map((row) => ({
    createdAt: isoDate(row.createdAt) ?? "",
    current: row.id === currentSessionId,
    expiresAt: isoDate(row.expiresAt) ?? "",
    id: row.id,
    ipAddress: row.ipAddress,
    updatedAt: isoDate(row.updatedAt) ?? "",
    userAgent: row.userAgent,
  }));
}

export async function revokeAccountSession(
  database: D1Database,
  userId: string,
  currentSessionId: string,
  sessionId: string,
): Promise<boolean> {
  if (sessionId === currentSessionId) return false;
  const result = await database.prepare(
    `DELETE FROM "auth_session"
     WHERE "id" = ?1 AND "userId" = ?2 AND "id" != ?3`,
  ).bind(sessionId, userId, currentSessionId).run();
  return result.meta.changes === 1;
}

export async function revokeOtherAccountSessions(
  database: D1Database,
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await database.prepare(
    `DELETE FROM "auth_session"
     WHERE "userId" = ?1 AND "id" != ?2`,
  ).bind(userId, currentSessionId).run();
  return result.meta.changes;
}

export async function listAccountPasskeys(
  database: D1Database,
  userId: string,
): Promise<AccountPasskeySummary[]> {
  const rows = await database.prepare(
    `SELECT "id", "name", "deviceType", "backedUp", "createdAt", "aaguid"
     FROM "passkey"
     WHERE "userId" = ?1
     ORDER BY "createdAt" DESC, "id" ASC`,
  ).bind(userId).all<PasskeyRow>();
  return rows.results.map((row) => ({
    backedUp: Boolean(row.backedUp),
    createdAt: isoDate(row.createdAt),
    deviceType: row.deviceType,
    id: row.id,
    name: row.name?.trim() || "Passkey",
    provider: getAuthenticatorName(row.aaguid) ?? null,
  }));
}
