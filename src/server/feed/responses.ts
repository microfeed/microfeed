import {resolveItemRoute} from "@/server/items/urls";
import {env} from "cloudflare:workers";

import {adminBasePath} from "@/shared/AdminPath";
import {getIdFromSlug} from "@/shared/StringUtils";
import {STATUSES} from "@/shared/Constants";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import type {FeedContent, PublicFeed} from "@/types";
import {
  isPublicFeedOffline,
  loadPublishedFeed,
} from "./feed";
import {jsonResponse} from "@/server/http";
import {publicSiteFileResponse} from "@/server/site-files/public";
import {chapterDocument, CHAPTERS_CONTENT_TYPE, type ItemPodcast} from "@/shared/Podcast";

export async function podcastChaptersData(request: Request, itemSlug: string): Promise<ReturnType<typeof chapterDocument> | Response> {
  const itemId = await resolveItemRoute(env.FEED_DB, itemSlug);
  if (!itemId) return new Response(null, {status: 404});
  const loaded = await loadPublishedFeed(env, request, {
    limit: 1, queryKwargs: {id: itemId, "status__in": [STATUSES.PUBLISHED, STATUSES.UNLISTED]},
  });
  const unavailable = feedUnavailable(loaded.content);
  if (unavailable) return new Response(null, {status: unavailable.status});
  const redirect = onboardingRedirect(request, loaded.onboarding.requiredOk);
  if (redirect) return redirect;
  const podcast = loaded.content.items?.[0]?.podcast as ItemPodcast | undefined;
  if (!podcast?.chapters?.length || subscriptionDisabled(loaded.content, "rss")) {
    return new Response(null, {status: 404});
  }
  return chapterDocument(podcast.chapters);
}

export async function podcastChaptersResponse(request: Request, itemSlug: string): Promise<Response> {
  const data = await podcastChaptersData(request, itemSlug);
  if (data instanceof Response) return data;
  return new Response(request.method === "HEAD" ? null : JSON.stringify(data), {
    headers: {
      "content-type": `${CHAPTERS_CONTENT_TYPE}; charset=utf-8`,
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function feedUnavailable(content: FeedContent): Response | null {
  if (isPublicFeedOffline(content)) {
    return new Response("Not Found", {status: 404, statusText: "Not Found"});
  }
  return null;
}

function onboardingRedirect(
  request: Request,
  onboardingRequiredOk: boolean,
): Response | null {
  if (onboardingRequiredOk) {
    return null;
  }
  return Response.redirect(
    new URL(adminBasePath(env.MICROFEED_ADMIN_PATH), request.url),
    302,
  );
}

function subscriptionDisabled(content: FeedContent, type: string): boolean {
  const methods = content.settings?.subscribeMethods?.methods ?? [];
  return methods.some(
    (method) =>
      method.type === type &&
      method.editable === false &&
      method.enabled === false,
  );
}

export async function jsonFeedData(
  request: Request,
  checkSubscription = true,
  itemSlug?: string,
  itemStatuses: number[] = [STATUSES.PUBLISHED, STATUSES.UNLISTED],
  checkAccessPolicy = true,
  searchParams?: URLSearchParams,
): Promise<PublicFeed | Response> {
  const itemId = itemSlug ? (checkAccessPolicy ? await resolveItemRoute(env.FEED_DB, itemSlug) : getIdFromSlug(itemSlug)) : undefined;
  if (itemSlug && !itemId) {
    return new Response("Not Found", {status: 404});
  }
  const loaded = await loadPublishedFeed(env, request, itemId
    ? {
        limit: 1,
        queryKwargs: {
          id: itemId,
          "status__in": itemStatuses,
        },
      }
    : {searchParams});
  const unavailable = checkAccessPolicy ? feedUnavailable(loaded.content) : null;
  if (unavailable) {
    return unavailable;
  }
  const redirect = onboardingRedirect(request, loaded.onboarding.requiredOk);
  if (redirect) {
    return redirect;
  }
  if (checkSubscription && subscriptionDisabled(loaded.content, "json")) {
    return new Response("Not Found", {status: 404});
  }
  if (itemId && loaded.publicFeed.items.length === 0) {
    return new Response("Not Found", {status: 404});
  }
  return loaded.publicFeed;
}

export const JSON_FEED_HEADERS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json;charset=UTF-8",
} as const;

export async function jsonFeedResponse(...args: Parameters<typeof jsonFeedData>): Promise<Response> {
  const data = await jsonFeedData(...args);
  return data instanceof Response ? data : jsonResponse(data, {headers: JSON_FEED_HEADERS});
}

export async function rssFeedResponse(
  request: Request,
  itemSlug?: string,
): Promise<Response> {
  const itemId = itemSlug ? await resolveItemRoute(env.FEED_DB, itemSlug) : undefined;
  if (itemSlug && !itemId) {
    return new Response("Not Found", {status: 404});
  }
  const loaded = await loadPublishedFeed(env, request, itemId
    ? {
        limit: 1,
        queryKwargs: {
          id: itemId,
          "status__in": [STATUSES.PUBLISHED, STATUSES.UNLISTED],
        },
      }
    : {});
  const unavailable = feedUnavailable(loaded.content);
  if (unavailable) {
    return unavailable;
  }
  const redirect = onboardingRedirect(request, loaded.onboarding.requiredOk);
  if (redirect) {
    return redirect;
  }
  if (subscriptionDisabled(loaded.content, "rss")) {
    return new Response("Not Found", {status: 404});
  }
  if (itemId && loaded.publicFeed.items.length === 0) {
    return new Response("Not Found", {status: 404});
  }

  const rss = new FeedPublicRssBuilder(
    loaded.publicFeed,
    new URL(request.url).origin,
  ).getRssData();
  return new Response(rss, {
    headers: {"content-type": "application/xml"},
  });
}

export async function rssStylesheetResponse(request: Request): Promise<Response> {
  const loaded = await loadPublishedFeed(env, request, {
    includeActiveTheme: true,
    limit: 1,
  });
  const theme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    null,
    loaded.content.activeTheme,
    themeAssetBaseUrl(
      env,
      request.url,
      loaded.content.activeTheme?.assetOwnerThemeId,
      loaded.content.activeTheme?.bundle.assets,
      loaded.content.settings?.webGlobalSettings?.publicBucketUrl,
    ),
  );
  return new Response(theme.getRssStylesheet().stylesheet, {
    headers: {"content-type": "text/xsl"},
  });
}

export async function sitemapResponse(request: Request): Promise<Response> {
  return publicSiteFileResponse(env, request, "sitemap.xml");
}

export function publicFeedHead(): Response {
  return new Response("ok");
}
