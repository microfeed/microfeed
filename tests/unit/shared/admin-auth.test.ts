import {describe, expect, it} from "vitest";

import {
  builtInAdminAuthEnabled,
  normalizeAdminAuthMode,
} from "@/shared/AdminAuth";
import {adminAuthSetupOptions} from "../../../manage-cli/lib/prompts";

describe("admin authentication mode", () => {
  it("keeps built-in authentication as the safe default", () => {
    expect(normalizeAdminAuthMode(undefined)).toBe("built-in");
    expect(builtInAdminAuthEnabled(undefined)).toBe(true);
    expect(adminAuthSetupOptions[0]).toMatchObject({
      label: expect.stringContaining("Recommended"),
      value: "built-in",
    });
  });

  it("supports an explicit public-admin mode with a warning", () => {
    expect(normalizeAdminAuthMode("none")).toBe("none");
    expect(builtInAdminAuthEnabled("none")).toBe(false);
    expect(adminAuthSetupOptions[1]).toMatchObject({
      hint: expect.stringContaining("public"),
      value: "none",
    });
  });
});
