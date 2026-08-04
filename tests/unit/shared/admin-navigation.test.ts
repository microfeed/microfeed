import {describe, expect, it} from "vitest";

import {getAdminNavigationItems} from "@/shared/AdminNavigation";
import {NAV_ITEMS} from "@/shared/Constants";

describe("getAdminNavigationItems", () => {
  it("generates URLs for the configured admin path and marks the active route", () => {
    const items = getAdminNavigationItems(
      "studio",
      NAV_ITEMS.ALL_ITEMS,
      {requiredOk: true},
    );

    expect(items.map(({id, url}) => [id, url])).toEqual([
      [NAV_ITEMS.ADMIN_HOME, "/studio/"],
      [NAV_ITEMS.EDIT_CHANNEL, "/studio/channels/primary/"],
      [NAV_ITEMS.ALL_ITEMS, "/studio/items/list/"],
      [NAV_ITEMS.API, "/studio/api/"],
      [NAV_ITEMS.SETTINGS, "/studio/settings/"],
    ]);
    expect(items.filter((item) => item.active).map((item) => item.id)).toEqual([
      NAV_ITEMS.ALL_ITEMS,
    ]);
  });

  it("keeps Home enabled while onboarding blocks the remaining routes", () => {
    const items = getAdminNavigationItems(
      "admin",
      NAV_ITEMS.ADMIN_HOME,
      {requiredOk: false},
    );

    expect(items[0]?.disabled).toBe(false);
    expect(items.slice(1).every((item) => item.disabled)).toBe(true);
  });
});
