import {env} from "cloudflare:workers";
import {loadPublishedFeed, isPublicFeedOffline, shouldHidePublicWeb} from "@/server/feed/feed";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {buildItemPaginationUrl} from "@/shared/ItemPagination";
import {adminBasePath} from "@/shared/AdminPath";
import {TagRequestError, tagSlugError} from "@/shared/Tags";
import {resolveTagRoute} from "./service";

export async function loadTagFeed(request: Request, slug: string, format: "web" | "rss" | "json" = "web") {
  const origin = new URL(request.url).origin;
  if (tagSlugError(slug)) return new Response("Not Found", {status: 404});
  const tag = await resolveTagRoute(env.FEED_DB, origin, slug);
  if (!tag) return new Response("Not Found", {status: 404});
  const loaded = await loadPublishedFeed(env, request, {includeActiveTheme: format === "web", queryKwargs: {tag_id: tag.id}});
  if (format === "web" ? shouldHidePublicWeb(loaded.content) : isPublicFeedOffline(loaded.content))
    return new Response("Not Found", {status: 404});
  if (!loaded.onboarding.requiredOk) return Response.redirect(new URL(adminBasePath(env.MICROFEED_ADMIN_PATH), origin), 302);
  const methods = loaded.content.settings?.subscribeMethods?.methods ?? [];
  if (format !== "web" && methods.some(method => method.type === format && method.editable === false && method.enabled === false))
    return new Response("Not Found", {status: 404});
  if (slug !== tag.slug) {
    const destination = new URL(format === "rss" ? tag.rss_url : format === "json" ? tag.json_url : tag.url);
    destination.search = new URL(request.url).search;
    return Response.redirect(destination, 301);
  }
  const publicFeed = loaded.publicFeed;
  const extra = publicFeed._microfeed ?? {};
  const pagination = {legacySort: loaded.content.items_sort_order, order: loaded.content.items_order, sort: loaded.content.items_sort};
  const feed: import("@/types").PublicFeed & {_microfeed: Record<string, unknown>} = {...publicFeed, title: tag.name, description: tag.description,
    home_page_url: tag.url, feed_url: tag.json_url,
    _microfeed: {...extra, tag, description_text: tag.description,
      subscribe_methods: Array.isArray(extra.subscribe_methods) ? extra.subscribe_methods.map((method: Record<string, unknown>) => ({...method,
        ...(method.type === "rss" ? {url: tag.rss_url} : method.type === "json" ? {url: tag.json_url} : {})})) : [],
    }};
  delete feed.next_url;
  if (loaded.content.items_next_cursor !== undefined) {
    feed.next_url = buildItemPaginationUrl(tag.json_url, {...pagination, nextCursor: loaded.content.items_next_cursor});
    feed._microfeed.next_url = buildItemPaginationUrl(request.url, {...pagination, nextCursor: loaded.content.items_next_cursor});
  }
  if (loaded.content.items_prev_cursor !== undefined)
    feed._microfeed.prev_url = buildItemPaginationUrl(request.url, {...pagination, prevCursor: loaded.content.items_prev_cursor});
  return {...loaded, tag, tagFeed: feed};
}

export async function tagFeedResponse(request: Request, slug: string, format: "rss" | "json") {
  const loaded = await loadTagFeed(request, slug, format);
  if (loaded instanceof Response) return loaded;
  const body = format === "json" ? JSON.stringify(loaded.tagFeed) : new FeedPublicRssBuilder(loaded.tagFeed, new URL(request.url).origin).getRssData();
  return new Response(request.method === "HEAD" ? null : body, {headers: {
    "content-type": format === "json" ? "application/feed+json; charset=utf-8" : "application/rss+xml; charset=utf-8",
    "access-control-allow-origin": "*", "x-content-type-options": "nosniff",
  }});
}

export function tagListCursor(request: Request) {
  const cursor = new URL(request.url).searchParams.get("next_cursor") ?? undefined;
  if (cursor && cursor.length > 200) throw new TagRequestError("Invalid tag directory cursor.");
  return cursor;
}
