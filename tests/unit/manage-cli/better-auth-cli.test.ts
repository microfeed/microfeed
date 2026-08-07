import {describe, expect, it} from "vitest";

import {
  normalizeOwnerEmail,
  ownerEmailUpdateSql,
  ownerInsertSql,
  passwordResetSql,
  passwordSetupSql,
  validateOwnerPassword,
} from "../../../manage-cli/lib/auth";

describe("Better Auth owner provisioning", () => {
  it("normalizes email and enforces the password length", () => {
    expect(normalizeOwnerEmail(" Owner@Example.com ")).toBe(
      "owner@example.com",
    );
    expect(validateOwnerPassword("short")).toContain("at least");
    expect(validateOwnerPassword("long enough password")).toBeUndefined();
  });

  it("stores Better Auth's hash without writing the plaintext password", async () => {
    const password = "a private password";
    const sql = await ownerInsertSql("owner@example.com", password);

    expect(sql).toContain("\"auth_user\"");
    expect(sql).toContain("\"auth_account\"");
    expect(sql).toContain("'credential'");
    expect(sql).not.toContain(password);
  });

  it("stores only the hash of a one-time browser password link", () => {
    const rawToken = "private-browser-token";
    const tokenHash = "f".repeat(64);
    const sql = passwordSetupSql({
      email: " Owner@Example.com ",
      expiresAt: "2026-07-31T12:30:00.000Z",
      purpose: "initial",
      tokenHash,
      userId: null,
    });

    expect(sql).toContain(tokenHash);
    expect(sql).toContain("owner@example.com");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).not.toContain(rawToken);
  });

  it("updates local credentials without retaining plaintext or sessions", async () => {
    const owner = {
      email: "owner@example.com",
      id: "owner-id",
      role: "admin",
    };
    const password = "a replacement private password";
    const passwordSql = await passwordResetSql(owner, password);
    const emailSql = ownerEmailUpdateSql(owner, " New-Owner@Example.com ");

    expect(passwordSql).toContain('UPDATE "auth_account"');
    expect(passwordSql).toContain('DELETE FROM "auth_session"');
    expect(passwordSql).toContain('DELETE FROM "oauth_access_token"');
    expect(passwordSql).toContain('DELETE FROM "oauth_refresh_token"');
    expect(passwordSql).toContain('DELETE FROM "oauth_consent"');
    expect(passwordSql).not.toContain(password);
    expect(emailSql).toContain("new-owner@example.com");
    expect(emailSql).toContain('DELETE FROM "auth_session"');
  });
});
