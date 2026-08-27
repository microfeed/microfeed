import {describe, expect, it} from "vitest";

import {
  ADMIN_DASHBOARD_LOGIN_HELP_URL,
  adminDashboardLockedResponse,
} from "@/server/auth/admin-owner";
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

  it("locks the remote dashboard with actionable setup guidance", async () => {
    const response = adminDashboardLockedResponse(true, {
      instanceName: "production-feed",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    const body = await response.text();
    expect(body).toContain("The admin dashboard is locked");
    expect(body).toContain(
      "<pre><code>npx @microfeed/cli manage auth setup --instance " +
        "production-feed</code></pre>",
    );
    expect(body).not.toContain("npx @microfeed/cli manage auth disable");
    expect(body).toContain(
      `To learn more about dashboard login: <a href="${ADMIN_DASHBOARD_LOGIN_HELP_URL}">` +
        "Manage the dashboard login</a>",
    );
  });

  it("adds a copyable disable command for a local-only instance", async () => {
    const response = adminDashboardLockedResponse(true, {
      instanceName: "local",
      local: true,
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    const body = await response.text();
    expect(body).toContain("The admin dashboard is locked");
    expect(body).toContain(
      "<pre><code>npx @microfeed/cli manage auth setup --instance local</code></pre>",
    );
    expect(body).toContain(
      "<pre><code>npx @microfeed/cli manage auth disable --instance local</code></pre>",
    );
    expect(body).toContain(ADMIN_DASHBOARD_LOGIN_HELP_URL);
  });

  it("keeps machine-oriented locked responses as actionable plain text", async () => {
    const response = adminDashboardLockedResponse(false, {
      instanceName: "local",
      local: true,
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    const body = await response.text();
    expect(body).toContain("npx @microfeed/cli manage auth setup --instance local");
    expect(body).toContain("npx @microfeed/cli manage auth disable --instance local");
    expect(body).toContain(ADMIN_DASHBOARD_LOGIN_HELP_URL);
  });
});
