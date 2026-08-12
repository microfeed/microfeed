import {normalizeAdminPath} from "./AdminPath";

export const PAGE_SLUG_MAX_LENGTH = 100;

const RESERVED_PAGE_SLUGS = new Set([
  ".well-known",
  "_astro",
  "api",
  "assets",
  "cdn-cgi",
  "i",
  "json",
  "llms.txt",
  "media",
  "media-upload",
  "robots.txt",
  "rss",
  "search",
  "sitemap.xml",
]);

export interface PageRecord {
  content_html: string;
  content_text: string;
  date_created: string;
  date_modified: string;
  date_published?: string;
  id: string;
  meta_description?: string;
  navigation_label: string;
  navigation_order: number;
  show_in_navigation: boolean;
  slug: string;
  status: "published" | "unlisted" | "unpublished";
  title: string;
  url: string;
}

export interface PageNavigationEntry {
  id: string;
  navigation_label: string;
  navigation_order: number;
  slug: string;
  title: string;
  url: string;
}

export function normalizePageSlug(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/^\/+|\/+$/gu, "");
}

export function slugifyPageTitle(value: string): string {
  return value.normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, PAGE_SLUG_MAX_LENGTH)
    .replace(/-+$/gu, "");
}

export function validatePageSlug(
  value: string,
  adminPath?: string | null,
): string | undefined {
  const slug = normalizePageSlug(value);
  if (!slug || slug.length > PAGE_SLUG_MAX_LENGTH) {
    return `Use 1–${PAGE_SLUG_MAX_LENGTH} characters.`;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    return "Use lowercase letters, numbers, and single hyphens.";
  }
  if (
    RESERVED_PAGE_SLUGS.has(slug) ||
    slug === normalizeAdminPath(adminPath)
  ) {
    return `\`${slug}\` is reserved by microfeed.`;
  }
  return undefined;
}

export function publicPagePath(slug: string): string {
  return `/${normalizePageSlug(slug)}/`;
}

export function publicPageUrl(slug: string, baseUrl: string): string {
  return new URL(publicPagePath(slug), baseUrl).toString();
}
