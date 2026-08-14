import {normalizeAdminPath} from "./AdminPath";
import {STATUSES} from "./Constants";

export const PAGE_SLUG_MAX_LENGTH = 100;
export const PAGE_META_DESCRIPTION_MAX_LENGTH = 155;
export const DEFAULT_NOT_FOUND_PAGE_ID = "system-404";
export const DEFAULT_NOT_FOUND_PAGE_SLUG = "404";

const RESERVED_PAGE_SLUGS = new Set([
  ".well-known",
  "_astro",
  DEFAULT_NOT_FOUND_PAGE_SLUG,
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
  is_not_found_page: boolean;
  meta_description?: string;
  navigation_label: string;
  navigation_order: number;
  show_in_navigation: boolean;
  slug: string;
  status: "published" | "unlisted" | "unpublished";
  title: string;
  url: string;
}

export function isNotFoundPageSlug(value: string): boolean {
  return normalizePageSlug(value) === DEFAULT_NOT_FOUND_PAGE_SLUG;
}

export interface PageNavigationEntry {
  id: string;
  navigation_label: string;
  navigation_order: number;
  slug: string;
  title: string;
  url: string;
}

export function pageNavigationEnabledForStatus(
  status: PageRecord["status"] | number,
  showInNavigation: boolean,
): boolean {
  return status !== "unlisted" && status !== STATUSES.UNLISTED &&
    showInNavigation;
}

export function normalizePageSlug(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/^\/+|\/+$/gu, "");
}

export function normalizePageSlugInput(value: string): string {
  return normalizePageSlug(value.replace(/\//gu, ""))
    .slice(0, PAGE_SLUG_MAX_LENGTH);
}

export function validatePageSlug(
  value: string,
  adminPath?: string | null,
): string | undefined {
  const slug = normalizePageSlug(value);
  if (!slug) {
    return "Enter a URL path, such as about.";
  }
  if (slug.length > PAGE_SLUG_MAX_LENGTH) {
    return `Use no more than ${PAGE_SLUG_MAX_LENGTH} characters.`;
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
