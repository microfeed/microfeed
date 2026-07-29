import {hashPassword} from "better-auth/crypto";

import {
  normalizeAdminEmail,
  validateAdminSetupCredentials,
} from "@/shared/AdminCredentials";
import {hasAdminOwner} from "@/server/auth/admin-owner";

export type AdminBootstrapStatus =
  | "already_initialized"
  | "created"
  | "invalid"
  | "unavailable";

type AdminBootstrapEnv = Pick<
  Env,
  | "FEED_DB"
  | "MICROFEED_SETUP_ADMIN_EMAIL"
  | "MICROFEED_SETUP_ADMIN_PASSWORD"
  | "MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION"
>;

function hasAnySetupBinding(runtimeEnv: AdminBootstrapEnv): boolean {
  return runtimeEnv.MICROFEED_SETUP_ADMIN_EMAIL !== undefined ||
    runtimeEnv.MICROFEED_SETUP_ADMIN_PASSWORD !== undefined ||
    runtimeEnv.MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION !== undefined;
}

export async function bootstrapAdmin(
  runtimeEnv: AdminBootstrapEnv,
): Promise<AdminBootstrapStatus> {
  if (!hasAnySetupBinding(runtimeEnv)) {
    return "unavailable";
  }

  if (await hasAdminOwner(runtimeEnv.FEED_DB)) {
    return "already_initialized";
  }

  const email = runtimeEnv.MICROFEED_SETUP_ADMIN_EMAIL;
  const password = runtimeEnv.MICROFEED_SETUP_ADMIN_PASSWORD;
  const passwordConfirmation =
    runtimeEnv.MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION;
  if (
    email === undefined ||
    password === undefined ||
    passwordConfirmation === undefined ||
    validateAdminSetupCredentials({
      email,
      password,
      passwordConfirmation,
    })
  ) {
    return "invalid";
  }

  const normalizedEmail = normalizeAdminEmail(email);
  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    await runtimeEnv.FEED_DB.batch([
      runtimeEnv.FEED_DB.prepare(
        'INSERT INTO "auth_user" ' +
          '("id", "name", "email", "emailVerified", "createdAt", ' +
          '"updatedAt", "role") VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(
        userId,
        normalizedEmail,
        normalizedEmail,
        1,
        timestamp,
        timestamp,
        "admin",
      ),
      runtimeEnv.FEED_DB.prepare(
        'INSERT INTO "auth_account" ' +
          '("id", "accountId", "providerId", "userId", "password", ' +
          '"createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(
        accountId,
        userId,
        "credential",
        userId,
        passwordHash,
        timestamp,
        timestamp,
      ),
    ]);
    return "created";
  } catch (error) {
    if (await hasAdminOwner(runtimeEnv.FEED_DB)) {
      return "already_initialized";
    }
    throw error;
  }
}

function notFound(): Response {
  return new Response("404", {
    headers: {"content-type": "text/plain; charset=utf-8"},
    status: 404,
  });
}

export async function handleAdminBootstrap(
  runtimeEnv: AdminBootstrapEnv,
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return notFound();
  }

  try {
    const status = await bootstrapAdmin(runtimeEnv);
    if (status === "unavailable") {
      return notFound();
    }
    if (status === "invalid") {
      return Response.json(
        {error: "Dashboard login could not be initialized."},
        {status: 400},
      );
    }
    return Response.json({status});
  } catch {
    return Response.json(
      {error: "Dashboard login could not be initialized."},
      {status: 500},
    );
  }
}
