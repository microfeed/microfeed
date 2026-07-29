import {describe, expect, it} from "vitest";

import {isExistingItemEditorPath} from "@/server/admin-routes";

describe("admin item routes", () => {
  it.each([
    "/admin/items/list",
    "/admin/items/list/",
    "/admin/items/new",
    "/admin/items/new/",
    "/admin/items/",
    "/admin/items/an-item/extra/",
    "/admin/settings/",
  ])("initializes shared admin context for %s", (pathname) => {
    expect(isExistingItemEditorPath(pathname)).toBe(false);
  });

  it.each([
    "/admin/items/123",
    "/admin/items/123/",
    "/admin/items/new-item/",
  ])("lets the existing item page load its own context for %s", (pathname) => {
    expect(isExistingItemEditorPath(pathname)).toBe(true);
  });
});
