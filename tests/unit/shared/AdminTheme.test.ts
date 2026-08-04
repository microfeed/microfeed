import {describe, expect, it} from "vitest";

import {
  ADMIN_THEME_STORAGE_KEY,
  parseAdminTheme,
  resolveAdminTheme,
} from "@/shared/AdminTheme";

describe("admin theme preference", () => {
  it("defaults first visits and invalid stored values to light", () => {
    expect(ADMIN_THEME_STORAGE_KEY).toBe("microfeed-admin-theme");
    expect(parseAdminTheme(null)).toBe("light");
    expect(parseAdminTheme("sepia")).toBe("light");
  });

  it.each(["light", "dark", "system"] as const)(
    "accepts a saved %s preference",
    (preference) => {
      expect(parseAdminTheme(preference)).toBe(preference);
    },
  );

  it("follows the operating system only for System mode", () => {
    expect(resolveAdminTheme("system", true)).toBe("dark");
    expect(resolveAdminTheme("system", false)).toBe("light");
    expect(resolveAdminTheme("light", true)).toBe("light");
    expect(resolveAdminTheme("dark", false)).toBe("dark");
  });
});
