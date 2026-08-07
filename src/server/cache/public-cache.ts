import {isAdminPathname} from "@/shared/AdminPath";
import {
  ITEMS_SORT_ORDERS,
  SETTINGS_CATEGORIES,
} from "@/shared/Constants";
import {
  decodeItemCursor,
  ITEM_ORDERS,
  ITEM_SORTS,
} from "@/shared/ItemPagination";
import {getIdFromSlug} from "@/shared/StringUtils";
import type {FeedContent, ImageMetadataTarget} from "@/types";

export const PUBLIC_CACHE_BROWSER_CONTROL = "no-cache";
export const PUBLIC_CACHE_EDGE_CONTROL =
  "public, max-age=300, stale-if-error=86400";
export const PRIVATE_CACHE_CONTROL = "private, no-store";

export const PUBLIC_CACHE_TAGS = {
  CHANNEL_PRIMARY: "mf:channel:primary",
  ITEMS: "mf:items",
  PUBLIC: "mf:public",
  THEME_CURRENT: "mf:theme:current",
  item: (itemId: string) => `mf:item:${itemId}`,
} as const;

export type PublicCachePurger = Pick<CacheContext, "purge">;

interface WorkerCachePolicyOptions {
  adminPath: string;
  deploymentEnvironment?: "preview" | "production";
}

const PAGINATED_PUBLIC_PATHS = new Set(["/", "/json/", "/rss/"]);
const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/.well-known/microfeed.json",
  "/json/",
  "/rss/",
  "/rss/stylesheet/",
  "/sitemap.xml",
]);
const PAGINATION_PARAMETERS = new Set([
  "next_cursor",
  "order",
  "prev_cursor",
  "sort",
]);
const FEED_CONTENT_PATHS = new Set([
  "/",
  "/json/",
  "/rss/",
  "/rss/stylesheet/",
  "/sitemap.xml",
]);

function normalizedTags(tags: Iterable<string>): string[] {
  return [...new Set(tags)].filter(
    (tag) => /^[\x21-\x7e]{1,1024}$/u.test(tag) && !tag.includes(","),
  );
}

function isItemPath(pathname: string): boolean {
  return /^\/i\/[^/]+\/(?:json\/|rss\/)?$/u.test(pathname);
}

function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_PATHS.has(pathname) || isItemPath(pathname);
}

function isPublicAssetPath(pathname: string): boolean {
  return pathname.startsWith("/_astro/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/media/");
}

function itemIdForPath(pathname: string): string | undefined {
  const slug = /^\/i\/([^/]+)\/(?:json\/|rss\/)?$/u.exec(pathname)?.[1];
  return slug ? getIdFromSlug(slug) : undefined;
}

function isFeedContentPath(pathname: string): boolean {
  return FEED_CONTENT_PATHS.has(pathname) || isItemPath(pathname);
}

function isThemePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/rss/stylesheet/" ||
    /^\/i\/[^/]+\/$/u.test(pathname);
}

function validPaginationQuery(url: URL): boolean {
  if (!url.search) return true;
  if (!PAGINATED_PUBLIC_PATHS.has(url.pathname)) return false;

  const entries = [...url.searchParams.entries()];
  if (
    entries.some(([key]) => !PAGINATION_PARAMETERS.has(key)) ||
    new Set(entries.map(([key]) => key)).size !== entries.length ||
    (
      url.searchParams.has("next_cursor") &&
      url.searchParams.has("prev_cursor")
    )
  ) {
    return false;
  }

  const sort = url.searchParams.get("sort");
  const canonicalSort = sort === null ||
    Object.values(ITEM_SORTS).some((value) => value === sort);
  const legacySort = Object.values(ITEMS_SORT_ORDERS).some(
    (value) => value === sort,
  );
  if (!canonicalSort && !legacySort) return false;

  const order = url.searchParams.get("order");
  if (
    order !== null &&
    !Object.values(ITEM_ORDERS).some((value) => value === order)
  ) {
    return false;
  }
  if (legacySort && order !== null) return false;

  for (const key of ["next_cursor", "prev_cursor"]) {
    const value = url.searchParams.get(key);
    if (value === null) continue;
    if (legacySort) {
      if (!/^\d{1,16}$/u.test(value)) return false;
    } else if (value.length > 512 || !decodeItemCursor(value)) {
      return false;
    }
  }
  return true;
}

function isSensitivePath(pathname: string, adminPath: string): boolean {
  return isAdminPathname(pathname, adminPath) ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/media" ||
    pathname.startsWith("/media/") ||
    pathname === "/media-upload" ||
    pathname.startsWith("/media-upload/") ||
    pathname === "/.well-known/microfeed/bootstrap-admin" ||
    pathname.startsWith("/.well-known/microfeed/bootstrap-admin/");
}

export function publicCacheTagsForPath(pathname: string): string[] {
  const tags = new Set<string>([PUBLIC_CACHE_TAGS.PUBLIC]);
  if (isFeedContentPath(pathname)) {
    tags.add(PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY);
  }
  if (
    pathname === "/" || pathname === "/json/" || pathname === "/rss/" ||
    pathname === "/sitemap.xml"
  ) {
    tags.add(PUBLIC_CACHE_TAGS.ITEMS);
  }
  if (isThemePath(pathname)) {
    tags.add(PUBLIC_CACHE_TAGS.THEME_CURRENT);
  }
  const itemId = itemIdForPath(pathname);
  if (itemId) tags.add(PUBLIC_CACHE_TAGS.item(itemId));
  return normalizedTags(tags);
}

function isPublicCacheableResponse(
  request: Request,
  response: Response,
  options: WorkerCachePolicyOptions,
): boolean {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  return options.deploymentEnvironment !== "preview" &&
    (method === "GET" || method === "HEAD") &&
    response.status === 200 &&
    !request.headers.has("authorization") &&
    !response.headers.has("set-cookie") &&
    isPublicPagePath(url.pathname) &&
    !isSensitivePath(url.pathname, options.adminPath) &&
    validPaginationQuery(url);
}

function responseWithCacheHeaders(
  response: Response,
  headers: Headers,
): Response {
  if (response.status === 101) return response;
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function applyWorkerCachePolicy(
  request: Request,
  response: Response,
  options: WorkerCachePolicyOptions,
): Response {
  const headers = new Headers(response.headers);
  if (!isPublicCacheableResponse(request, response, options)) {
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    headers.delete("Cache-Tag");
    const publicAsset = options.deploymentEnvironment !== "preview" &&
      (request.method === "GET" || request.method === "HEAD") &&
      response.status === 200 &&
      !request.headers.has("authorization") &&
      !response.headers.has("set-cookie") &&
      isPublicAssetPath(new URL(request.url).pathname);
    if (!publicAsset) {
      headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
    }
    return responseWithCacheHeaders(response, headers);
  }

  headers.set("Cache-Control", PUBLIC_CACHE_BROWSER_CONTROL);
  headers.set("Cloudflare-CDN-Cache-Control", PUBLIC_CACHE_EDGE_CONTROL);
  headers.set(
    "Cache-Tag",
    publicCacheTagsForPath(new URL(request.url).pathname).join(","),
  );
  return responseWithCacheHeaders(response, headers);
}

export function publicCacheTagsForFeedUpdate(
  feed: FeedContent,
): string[] {
  const tags = new Set<string>();
  if (feed.item) {
    tags.add(PUBLIC_CACHE_TAGS.ITEMS);
    if (typeof feed.item.id === "string") {
      tags.add(PUBLIC_CACHE_TAGS.item(feed.item.id));
    }
  }
  if (feed.channel) {
    tags.add(PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY);
  }
  for (const category of Object.keys(feed.settings ?? {})) {
    if (category === SETTINGS_CATEGORIES.API_SETTINGS) continue;
    tags.add(
      category === SETTINGS_CATEGORIES.CUSTOM_CODE
        ? PUBLIC_CACHE_TAGS.THEME_CURRENT
        : PUBLIC_CACHE_TAGS.PUBLIC,
    );
  }
  return normalizedTags(tags);
}

export function publicCacheTagsForImageTarget(
  target: ImageMetadataTarget,
): string[] {
  if (target.type === "item") {
    return normalizedTags([
      PUBLIC_CACHE_TAGS.item(target.id),
      PUBLIC_CACHE_TAGS.ITEMS,
    ]);
  }
  if (target.type === "channel") {
    return [PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY];
  }
  return [PUBLIC_CACHE_TAGS.PUBLIC];
}

export async function purgePublicCache(
  tags: Iterable<string>,
  purger: PublicCachePurger,
): Promise<void> {
  const uniqueTags = normalizedTags(tags);
  if (uniqueTags.length === 0) return;
  try {
    const result = await purger.purge({tags: uniqueTags});
    if (!result.success) {
      console.error(JSON.stringify({
        errors: result.errors,
        message: "Failed to purge public Workers cache",
        tags: uniqueTags,
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      message: "Failed to purge public Workers cache",
      tags: uniqueTags,
    }));
  }
}
