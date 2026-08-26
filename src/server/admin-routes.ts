import {adminUrl} from "@/shared/AdminPath";

const RESERVED_ITEM_PATHS = new Set(["list", "new"]);

export function isAdminCollectionListPath(
  pathname: string,
  adminPath = "admin",
): boolean {
  return ["items/list", "pages", "site-files"].some(
    (path) => pathname === adminUrl(path, adminPath),
  );
}

export function isPublicPageCandidateForDynamicAdminRoute(
  pathname: string,
  routeAdminPath: string | undefined,
  configuredAdminPath: string,
): boolean {
  return Boolean(
    routeAdminPath &&
      routeAdminPath !== configuredAdminPath &&
      pathname === `/${routeAdminPath}/`,
  );
}

export function isExistingItemEditorPath(
  pathname: string,
  adminPath = "admin",
): boolean {
  const escapedPath = adminPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const itemEditorPath = new RegExp(
    `^/${escapedPath}/items/([^/]+)/?$`,
    "u",
  );
  const itemId = itemEditorPath.exec(pathname)?.[1];
  return Boolean(itemId && !RESERVED_ITEM_PATHS.has(itemId));
}
