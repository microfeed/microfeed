import {describe, expect, it} from "vitest";

import {
  ADMIN_SETTINGS_SECTIONS,
  filterAdminSettingsSections,
} from "@/shared/AdminSettingsNavigation";

describe("admin settings navigation", () => {
  it("keeps section links in page order with their labels and distinct icons", () => {
    expect(ADMIN_SETTINGS_SECTIONS.map(({id, name, icon}) => [id, name, icon])).toEqual([
      ["custom-code", "Website appearance & code", "code"],
      ["tracking-urls", "Tracking URLs", "activity"],
      ["access-control", "Access control", "shield"],
      ["subscribe-methods", "Subscribe methods", "rss"],
      ["media-file-storage", "Media file storage", "storage"],
      ["items-settings", "Items settings", "list"],
      ["favicon", "Favicon", "image"],
    ]);
  });

  it("filters sections case-insensitively and restores all on an empty query", () => {
    expect(filterAdminSettingsSections("SUBSCRIBE").map(({id}) => id)).toEqual([
      "subscribe-methods",
    ]);
    expect(filterAdminSettingsSections("STORAGE").map(({id}) => id)).toEqual([
      "media-file-storage",
    ]);
    expect(filterAdminSettingsSections("APPEARANCE").map(({id}) => id)).toEqual([
      "custom-code",
    ]);
    expect(filterAdminSettingsSections("  ")).toBe(ADMIN_SETTINGS_SECTIONS);
  });
});
