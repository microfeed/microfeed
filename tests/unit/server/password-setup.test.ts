import {describe, expect, it} from "vitest";

import {adminDashboardLockedResponse} from "@/server/auth/admin-owner";
import {isAdminPasswordSetupPath} from "@/server/auth/password-setup";

describe("admin password setup routing", () => {
  it("allows only the one-time entry, clean page, and completion endpoint", () => {
    expect(isAdminPasswordSetupPath(
      `/admin/login/${"a".repeat(64)}/set_password/`,
      "admin",
    )).toBe(true);
    expect(isAdminPasswordSetupPath(
      "/admin/login/not-a-valid-token/set_password/",
      "admin",
    )).toBe(true);
    expect(isAdminPasswordSetupPath(
      "/admin/login/set_password/",
      "admin",
    )).toBe(true);
    expect(isAdminPasswordSetupPath(
      "/admin/login/set_password/complete/",
      "admin",
    )).toBe(true);
    expect(isAdminPasswordSetupPath("/admin/login/", "admin")).toBe(false);
    expect(isAdminPasswordSetupPath("/admin/ajax/feed/", "admin")).toBe(
      false,
    );
  });

  it("locks the normal dashboard with HTTP 403 before an owner exists", async () => {
    const response = adminDashboardLockedResponse();

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain("locked");
  });
});
