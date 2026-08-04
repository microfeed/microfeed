import {describe, expect, it} from "vitest";

import {
  ADMIN_SETTINGS_SECTIONS,
  filterAdminSettingsSections,
} from "@/shared/AdminSettingsNavigation";

describe("admin settings navigation", () => {
  it("keeps section links in page order with their labels and distinct icons", () => {
    expect(ADMIN_SETTINGS_SECTIONS.map(({id, name, icon}) => [id, name, icon])).toEqual([
      ["tracking-urls", "Tracking URLs", "activity"],
      ["access-control", "Access control", "shield"],
      ["subscribe-methods", "Subscribe methods", "rss"],
      ["web-settings", "Global settings", "globe"],
      ["custom-code", "Custom code", "code"],
    ]);
  });

  it("filters sections case-insensitively and restores all on an empty query", () => {
    expect(filterAdminSettingsSections("SUBSCRIBE").map(({id}) => id)).toEqual([
      "subscribe-methods",
    ]);
    expect(filterAdminSettingsSections("GLOBAL").map(({id}) => id)).toEqual([
      "web-settings",
    ]);
    expect(filterAdminSettingsSections("  ")).toBe(ADMIN_SETTINGS_SECTIONS);
  });
});
