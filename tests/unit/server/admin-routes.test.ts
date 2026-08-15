import {describe, expect, it} from "vitest";

import {
  isAdminCollectionListPath,
  isExistingItemEditorPath,
  isPublicPageCandidateForDynamicAdminRoute,
} from "@/server/admin-routes";

describe("dynamic admin route collisions", () => {
  it("lets a one-segment public Page use the dynamic admin index route", () => {
    expect(isPublicPageCandidateForDynamicAdminRoute(
      "/about/",
      "about",
      "admin",
    )).toBe(true);
  });

  it.each([
    ["/admin/", "admin"],
    ["/about/pages/", "about"],
    ["/about", "about"],
  ])("does not treat %s as a public Page collision", (pathname, routePath) => {
    expect(isPublicPageCandidateForDynamicAdminRoute(
      pathname,
      routePath,
      "admin",
    )).toBe(false);
  });
});

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

describe("admin collection routes", () => {
  it.each([
    "/admin/items/list/",
    "/admin/pages/",
    "/admin/site-files/",
  ])("loads %s as an AJAX-backed collection shell", (pathname) => {
    expect(isAdminCollectionListPath(pathname)).toBe(true);
  });

  it.each([
    "/admin/items/list/extra/",
    "/admin/pages/new/",
    "/admin/pages/page-id/",
    "/admin/site-files/new/",
    "/admin/settings/",
  ])("keeps %s on its existing server data path", (pathname) => {
    expect(isAdminCollectionListPath(pathname)).toBe(false);
  });

  it("supports a custom admin path", () => {
    expect(isAdminCollectionListPath("/studio/pages/", "studio")).toBe(true);
    expect(isAdminCollectionListPath("/admin/pages/", "studio")).toBe(false);
  });
});
