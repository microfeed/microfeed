export const SITE_FILE_MAX_BYTES = 256 * 1024;
export const SITE_FILE_MAX_NAME_LENGTH = 128;

export const SITE_FILE_GENERATORS = [
  "robots",
  "llms",
  "sitemap",
] as const;

export type SiteFileGenerator = typeof SITE_FILE_GENERATORS[number];

export const SITE_FILE_MEDIA_TYPES = [
  "application/json",
  "application/manifest+json",
  "application/rss+xml",
  "application/xml",
  "text/css",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/yaml",
] as const;

export type SiteFileMediaType = typeof SITE_FILE_MEDIA_TYPES[number];

const MEDIA_TYPE_BY_EXTENSION: Record<string, SiteFileMediaType> = {
  atom: "application/xml",
  css: "text/css",
  csv: "text/csv",
  json: "application/json",
  md: "text/markdown",
  rss: "application/rss+xml",
  txt: "text/plain",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
};

const BLOCKED_SITE_FILE_NAMES = new Set([
  "favicon.ico",
  "openapi.json",
  "openapi.yaml",
]);

export interface SiteFileRecord {
  content_type: SiteFileMediaType;
  date_created: string;
  date_modified: string;
  date_published?: string;
  draft_content: string;
  enabled: boolean;
  filename: string;
  generator?: SiteFileGenerator;
  id: string;
  mode: "generated" | "override";
  published_content?: string;
  system: boolean;
  url: string;
}

export function normalizeSiteFilename(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/^\/+|\/+$/gu, "");
}

export function siteFileMediaTypeForName(
  filename: string,
): SiteFileMediaType | undefined {
  const extension = normalizeSiteFilename(filename).split(".").at(-1) ?? "";
  return MEDIA_TYPE_BY_EXTENSION[extension];
}

export function validateSiteFilename(value: string): string | undefined {
  const filename = normalizeSiteFilename(value);
  if (!filename || filename.length > SITE_FILE_MAX_NAME_LENGTH) {
    return `Use 1–${SITE_FILE_MAX_NAME_LENGTH} characters.`;
  }
  if (
    filename.startsWith(".") ||
    filename.includes("..") ||
    filename.includes("/") ||
    !/^[a-z0-9][a-z0-9._-]*\.[a-z0-9]+$/u.test(filename)
  ) {
    return "Use a lowercase root filename with a safe extension.";
  }
  if (BLOCKED_SITE_FILE_NAMES.has(filename)) {
    return `\`${filename}\` is reserved by microfeed.`;
  }
  if (!siteFileMediaTypeForName(filename)) {
    return "Use txt, xml, json, webmanifest, csv, css, yaml, yml, md, atom, or rss.";
  }
  return undefined;
}

export function validateSiteFileContent(
  content: string,
  contentType: SiteFileMediaType,
  options: {allowLargeGeneratedSitemap?: boolean} = {},
): string | undefined {
  if (content.includes("\0")) return "NUL bytes are not allowed.";
  if (
    !options.allowLargeGeneratedSitemap &&
    new TextEncoder().encode(content).byteLength > SITE_FILE_MAX_BYTES
  ) {
    return `Content must be ${SITE_FILE_MAX_BYTES} bytes or smaller.`;
  }
  if (
    contentType === "application/json" ||
    contentType === "application/manifest+json"
  ) {
    try {
      JSON.parse(content);
    } catch {
      return "Publish valid JSON content.";
    }
  }
  return undefined;
}

export function publicSiteFilePath(filename: string): string {
  return `/${normalizeSiteFilename(filename)}`;
}
