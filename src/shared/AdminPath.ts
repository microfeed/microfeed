export const DEFAULT_ADMIN_PATH = "admin";

const RESERVED_ADMIN_PATHS = new Set([
  ".well-known",
  "_astro",
  "api",
  "assets",
  "cdn-cgi",
  "i",
  "json",
  "media",
  "media-upload",
  "rss",
  "sitemap.xml",
]);

export function validateAdminPath(value: string): string | undefined {
  const segment = value.trim().replace(/^\/+|\/+$/gu, "");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(segment)) {
    return "Use one lowercase URL segment with letters, numbers, and hyphens.";
  }
  if (RESERVED_ADMIN_PATHS.has(segment)) {
    return `\`${segment}\` is reserved by microfeed. Choose another path.`;
  }
  return undefined;
}

export function normalizeAdminPath(value?: string | null): string {
  const segment = (value ?? DEFAULT_ADMIN_PATH)
    .trim()
    .replace(/^\/+|\/+$/gu, "");
  return validateAdminPath(segment) ? DEFAULT_ADMIN_PATH : segment;
}

export function adminBasePath(adminPath?: string | null): string {
  return `/${normalizeAdminPath(adminPath)}/`;
}

export function adminUrl(
  relativePath = "",
  adminPath?: string | null,
): string {
  const relative = relativePath.replace(/^\/+|\/+$/gu, "");
  return relative
    ? `${adminBasePath(adminPath)}${relative}/`
    : adminBasePath(adminPath);
}

export function isAdminPathname(
  pathname: string,
  adminPath?: string | null,
): boolean {
  const basePath = adminBasePath(adminPath);
  return pathname === basePath.slice(0, -1) || pathname.startsWith(basePath);
}

export function browserAdminPath(): string {
  if (typeof document === "undefined") {
    return DEFAULT_ADMIN_PATH;
  }
  const configuredPath = document
    .querySelector<HTMLMetaElement>('meta[name="microfeed-admin-path"]')
    ?.content;
  return normalizeAdminPath(configuredPath);
}
