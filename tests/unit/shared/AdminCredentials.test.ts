import {describe, expect, it} from "vitest";

import {
  normalizeAdminEmail,
  validateAdminPassword,
  validateAdminSetupCredentials,
} from "@/shared/AdminCredentials";

describe("admin credentials", () => {
  it("normalizes email and accepts spaces and Unicode in passwords", () => {
    expect(normalizeAdminEmail(" Admin@Example.com ")).toBe(
      "admin@example.com",
    );
    expect(validateAdminPassword("correct 🦊 password")).toBeUndefined();
  });

  it("enforces password length and confirmation", () => {
    expect(validateAdminPassword("too short")).toContain("at least");
    expect(validateAdminPassword("x".repeat(129))).toContain("no more");
    expect(validateAdminSetupCredentials({
      email: "admin@example.com",
      password: "correct horse battery staple",
      passwordConfirmation: "different password value",
    })).toBe("The passwords do not match.");
  });
});
