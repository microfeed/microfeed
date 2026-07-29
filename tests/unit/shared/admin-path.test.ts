import {describe, expect, it} from "vitest";

import {
  adminBasePath,
  adminUrl,
  isAdminPathname,
  normalizeAdminPath,
  validateAdminPath,
} from "@/shared/AdminPath";

describe("configurable dashboard paths", () => {
  it("normalizes a single segment and keeps trailing slashes", () => {
    expect(normalizeAdminPath("/studio/")).toBe("studio");
    expect(adminBasePath("studio")).toBe("/studio/");
    expect(adminUrl("items/list", "studio")).toBe("/studio/items/list/");
    expect(isAdminPathname("/studio/items/list/", "studio")).toBe(true);
    expect(isAdminPathname("/admin/", "studio")).toBe(false);
  });

  it("rejects reserved and unsafe paths", () => {
    expect(validateAdminPath("api")).toContain("reserved");
    expect(validateAdminPath("media")).toContain("reserved");
    expect(validateAdminPath("Admin")).toContain("lowercase");
    expect(validateAdminPath("two/segments")).toContain("one lowercase");
  });
});
