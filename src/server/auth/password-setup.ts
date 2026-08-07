import {hashPassword} from "better-auth/crypto";

import {
  normalizeAdminEmail,
  validateAdminSetupCredentials,
} from "@/shared/AdminCredentials";
import {adminUrl} from "@/shared/AdminPath";

export const ADMIN_PASSWORD_SETUP_TTL_SECONDS = 30 * 60;
export const ADMIN_PASSWORD_SETUP_COOKIE =
  "__Secure-microfeed-admin-password-setup";

export type AdminPasswordSetupPurpose = "initial" | "reset";

interface AdminPasswordSetupRow {
  createdAt: string;
  email: string;
  expiresAt: string;
  purpose: AdminPasswordSetupPurpose;
  tokenHash: string;
  userId: string | null;
}

export interface AdminPasswordSetup {
  email: string;
  expiresAt: string;
  purpose: AdminPasswordSetupPurpose;
}

interface PasswordCompletion {
  password?: unknown;
  passwordConfirmation?: unknown;
}

const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: {
      ...SECURITY_HEADERS,
      "content-type": "text/plain; charset=utf-8",
    },
    status,
  });
}

function goneResponse(): Response {
  return textResponse(
    "This password link has expired or was replaced. Run `yarn manage auth setup` for first-time administrator setup, or `yarn manage auth reset-password` for an existing administrator.",
    410,
  );
}

function cookieValue(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return undefined;
  }
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ADMIN_PASSWORD_SETUP_COOKIE) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function setupCookie(token: string, adminPath: string): string {
  return [
    `${ADMIN_PASSWORD_SETUP_COOKIE}=${encodeURIComponent(token)}`,
    `Max-Age=${ADMIN_PASSWORD_SETUP_TTL_SECONDS}`,
    `Path=${adminUrl("login/set_password", adminPath)}`,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

function clearSetupCookie(adminPath: string): string {
  return [
    `${ADMIN_PASSWORD_SETUP_COOKIE}=`,
    "Max-Age=0",
    `Path=${adminUrl("login/set_password", adminPath)}`,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function findSetup(
  database: D1Database,
  token: string,
): Promise<AdminPasswordSetupRow | undefined> {
  const tokenHash = await sha256Hex(token);
  const setup = await database.prepare(
    'SELECT "purpose", "email", "userId", "tokenHash", "createdAt", ' +
      '"expiresAt" FROM "auth_password_setup" WHERE "id" = ?',
  ).bind("owner").first<AdminPasswordSetupRow>();
  if (!setup) {
    return undefined;
  }
  const candidate = new TextEncoder().encode(tokenHash);
  const expected = new TextEncoder().encode(setup.tokenHash);
  if (candidate.byteLength !== expected.byteLength) {
    return undefined;
  }
  let difference = 0;
  for (let index = 0; index < candidate.byteLength; index += 1) {
    difference |= (candidate.at(index) ?? 0) ^ (expected.at(index) ?? 0);
  }
  return difference === 0 ? setup : undefined;
}

function isActive(setup: AdminPasswordSetupRow): boolean {
  return new Date(setup.expiresAt).getTime() > Date.now();
}

export function isAdminPasswordSetupPath(
  pathname: string,
  adminPath: string,
): boolean {
  const cleanPath = adminUrl("login/set_password", adminPath);
  const completionPath = adminUrl("login/set_password/complete", adminPath);
  if (pathname === cleanPath || pathname === completionPath) {
    return true;
  }
  const prefix = adminUrl("login", adminPath);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^${escapedPrefix}[^/]+/set_password/$`,
    "u",
  ).test(pathname);
}

export async function handleAdminPasswordSetupEntry(
  database: D1Database,
  request: Request,
  adminPath: string,
  token: string,
): Promise<Response> {
  if (request.method !== "GET" || !TOKEN_PATTERN.test(token)) {
    return textResponse("404", 404);
  }

  const setup = await findSetup(database, token);
  if (!setup || !isActive(setup)) {
    return goneResponse();
  }

  return new Response(null, {
    headers: {
      ...SECURITY_HEADERS,
      Location: adminUrl("login/set_password", adminPath),
      "Set-Cookie": setupCookie(token, adminPath),
    },
    status: 303,
  });
}

export async function currentAdminPasswordSetup(
  database: D1Database,
  request: Request,
): Promise<AdminPasswordSetup | undefined> {
  const token = cookieValue(request);
  if (!token || !TOKEN_PATTERN.test(token)) {
    return undefined;
  }
  const setup = await findSetup(database, token);
  if (!setup || !isActive(setup)) {
    return undefined;
  }
  return {
    email: setup.email,
    expiresAt: setup.expiresAt,
    purpose: setup.purpose,
  };
}

function completionError(error: string, status: number): Response {
  return Response.json(
    {error},
    {headers: SECURITY_HEADERS, status},
  );
}

export async function completeAdminPasswordSetup(
  database: D1Database,
  request: Request,
  adminPath: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return textResponse("404", 404);
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return completionError("Forbidden", 403);
  }

  const token = cookieValue(request);
  if (!token || !TOKEN_PATTERN.test(token)) {
    return completionError("This password link is no longer valid.", 410);
  }
  const setup = await findSetup(database, token);
  if (!setup || !isActive(setup)) {
    return completionError("This password link has expired or was replaced.", 410);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return completionError("The request is too large.", 413);
  }

  let input: PasswordCompletion;
  try {
    const body = await request.text();
    if (body.length > 2_048) {
      return completionError("The request is too large.", 413);
    }
    input = JSON.parse(body) as PasswordCompletion;
  } catch {
    return completionError("Enter and confirm a valid password.", 400);
  }

  const password = typeof input.password === "string" ? input.password : "";
  const passwordConfirmation = typeof input.passwordConfirmation === "string"
    ? input.passwordConfirmation
    : "";
  const validationError = validateAdminSetupCredentials({
    email: setup.email,
    password,
    passwordConfirmation,
  });
  if (validationError) {
    return completionError(validationError, 400);
  }

  const tokenHash = await sha256Hex(token);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  let results: D1Result[];

  if (setup.purpose === "initial") {
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    results = await database.batch([
      database.prepare(
        'INSERT INTO "auth_user" ("id", "name", "email", ' +
          '"emailVerified", "createdAt", "updatedAt", "role") ' +
          'SELECT ?, "email", "email", 1, ?, ?, ? FROM ' +
          '"auth_password_setup" WHERE "id" = ? AND "purpose" = ? ' +
          'AND "tokenHash" = ? AND "expiresAt" > ? AND NOT EXISTS ' +
          '(SELECT 1 FROM "auth_user")',
      ).bind(
        userId,
        now,
        now,
        "admin",
        "owner",
        "initial",
        tokenHash,
        now,
      ),
      database.prepare(
        'INSERT INTO "auth_account" ("id", "accountId", "providerId", ' +
          '"userId", "password", "createdAt", "updatedAt") ' +
          'SELECT ?, ?, ?, ?, ?, ?, ? FROM "auth_password_setup" ' +
          'WHERE "id" = ? AND "purpose" = ? AND "tokenHash" = ? ' +
          'AND "expiresAt" > ? AND EXISTS ' +
          '(SELECT 1 FROM "auth_user" WHERE "id" = ?)',
      ).bind(
        accountId,
        userId,
        "credential",
        userId,
        passwordHash,
        now,
        now,
        "owner",
        "initial",
        tokenHash,
        now,
        userId,
      ),
      database.prepare(
        'DELETE FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?',
      ).bind("owner", "initial", tokenHash, now),
    ]);
    if (results.some((result) => result.meta.changes !== 1)) {
      return completionError(
        "This password link was already used or replaced.",
        410,
      );
    }
  } else {
    results = await database.batch([
      database.prepare(
        'UPDATE "auth_account" SET "password" = ?, "updatedAt" = ? ' +
          'WHERE "providerId" = ? AND "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind(
        passwordHash,
        now,
        "credential",
        "owner",
        "reset",
        tokenHash,
        now,
      ),
      database.prepare(
        'DELETE FROM "oauth_access_token" WHERE "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind("owner", "reset", tokenHash, now),
      database.prepare(
        'DELETE FROM "oauth_refresh_token" WHERE "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind("owner", "reset", tokenHash, now),
      database.prepare(
        'DELETE FROM "oauth_consent" WHERE "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind("owner", "reset", tokenHash, now),
      database.prepare(
        'DELETE FROM "oauth_connection" WHERE "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind("owner", "reset", tokenHash, now),
      database.prepare(
        'DELETE FROM "auth_session" WHERE "userId" = (' +
          'SELECT "userId" FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?)',
      ).bind("owner", "reset", tokenHash, now),
      database.prepare(
        'DELETE FROM "auth_password_setup" WHERE "id" = ? ' +
          'AND "purpose" = ? AND "tokenHash" = ? AND "expiresAt" > ?',
      ).bind("owner", "reset", tokenHash, now),
    ]);
    if (results[0]?.meta.changes !== 1 || results[6]?.meta.changes !== 1) {
      return completionError(
        "This password link was already used or replaced.",
        410,
      );
    }
  }

  return Response.json(
    {
      email: normalizeAdminEmail(setup.email),
      status: setup.purpose === "initial" ? "created" : "reset",
    },
    {
      headers: {
        ...SECURITY_HEADERS,
        "Set-Cookie": clearSetupCookie(adminPath),
      },
    },
  );
}
