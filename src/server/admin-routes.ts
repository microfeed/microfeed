const RESERVED_ITEM_PATHS = new Set(["list", "new"]);

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
