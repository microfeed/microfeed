import {randomUUID} from "node:crypto";

import {hashPassword} from "better-auth/crypto";

import {normalizeAdminEmail} from "@/shared/AdminCredentials";

export {
  MAX_ADMIN_PASSWORD_LENGTH as MAX_PASSWORD_LENGTH,
  MIN_ADMIN_PASSWORD_LENGTH as MIN_PASSWORD_LENGTH,
  normalizeAdminEmail as normalizeOwnerEmail,
  validateAdminEmail as validateOwnerEmail,
  validateAdminPassword as validateOwnerPassword,
} from "@/shared/AdminCredentials";

export interface AuthOwner {
  email: string;
  id: string;
  role: string | null;
}

export interface AuthPasswordSetup {
  createdAt: string;
  email: string;
  expiresAt: string;
  purpose: "initial" | "reset";
  userId: string | null;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ownerInsertSql(
  emailInput: string,
  password: string,
): Promise<string> {
  const email = normalizeAdminEmail(emailInput);
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const accountId = randomUUID();
  const timestamp = new Date().toISOString();
  return [
    "INSERT INTO \"auth_user\" (" +
      "\"id\", \"name\", \"email\", \"emailVerified\", \"createdAt\", " +
      "\"updatedAt\", \"role\"" +
      ") VALUES (" +
      [
        sqlString(userId),
        sqlString(email),
        sqlString(email),
        "1",
        sqlString(timestamp),
        sqlString(timestamp),
        sqlString("admin"),
      ].join(", ") +
      ");",
    "INSERT INTO \"auth_account\" (" +
      "\"id\", \"accountId\", \"providerId\", \"userId\", \"password\", " +
      "\"createdAt\", \"updatedAt\"" +
      ") VALUES (" +
      [
        sqlString(accountId),
        sqlString(userId),
        sqlString("credential"),
        sqlString(userId),
        sqlString(passwordHash),
        sqlString(timestamp),
        sqlString(timestamp),
      ].join(", ") +
      ");",
  ].join("\n");
}

export function clearPasswordSetupSql(): string {
  return 'DELETE FROM "auth_password_setup" WHERE "id" = \'owner\';';
}

export function passwordSetupSql(input: {
  email: string;
  expiresAt: string;
  purpose: "initial" | "reset";
  tokenHash: string;
  userId: string | null;
}): string {
  const timestamp = new Date().toISOString();
  return [
    'INSERT INTO "auth_password_setup" (' +
      '"id", "purpose", "email", "userId", "tokenHash", "createdAt", ' +
      '"expiresAt") VALUES (' +
      [
        sqlString("owner"),
        sqlString(input.purpose),
        sqlString(normalizeAdminEmail(input.email)),
        input.userId === null ? "NULL" : sqlString(input.userId),
        sqlString(input.tokenHash),
        sqlString(timestamp),
        sqlString(input.expiresAt),
      ].join(", ") +
      ") ON CONFLICT(\"id\") DO UPDATE SET " +
      '"purpose" = excluded."purpose", ' +
      '"email" = excluded."email", ' +
      '"userId" = excluded."userId", ' +
      '"tokenHash" = excluded."tokenHash", ' +
      '"createdAt" = excluded."createdAt", ' +
      '"expiresAt" = excluded."expiresAt";',
  ].join("\n");
}

export async function passwordResetSql(
  owner: AuthOwner,
  password: string,
): Promise<string> {
  const passwordHash = await hashPassword(password);
  const timestamp = new Date().toISOString();
  return [
    "UPDATE \"auth_account\" SET " +
      `"password\" = ${sqlString(passwordHash)}, ` +
      `"updatedAt\" = ${sqlString(timestamp)} ` +
      `WHERE \"userId\" = ${sqlString(owner.id)} ` +
      "AND \"providerId\" = 'credential';",
    `DELETE FROM "auth_session" WHERE "userId" = ${sqlString(owner.id)};`,
  ].join("\n");
}

export function ownerEmailUpdateSql(
  owner: AuthOwner,
  emailInput: string,
): string {
  const email = normalizeAdminEmail(emailInput);
  const timestamp = new Date().toISOString();
  return [
    "UPDATE \"auth_user\" SET " +
      `"email\" = ${sqlString(email)}, ` +
      `"name\" = ${sqlString(email)}, ` +
      `"updatedAt\" = ${sqlString(timestamp)} ` +
      `WHERE \"id\" = ${sqlString(owner.id)};`,
    `DELETE FROM "auth_session" WHERE "userId" = ${sqlString(owner.id)};`,
  ].join("\n");
}
