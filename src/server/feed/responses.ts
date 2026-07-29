import {env} from "cloudflare:workers";

import {adminBasePath} from "@/shared/AdminPath";
import {escapeHtml, getIdFromSlug} from "@/shared/StringUtils";
import {STATUSES} from "@/shared/Constants";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import Theme from "@/server/themes/Theme";
import type {FeedContent} from "@/types";
import {loadPublishedFeed, shouldHidePublicFeed} from "./feed";
import {jsonResponse} from "@/server/http";

function feedUnavailable(content: FeedContent): Response | null {
  if (shouldHidePublicFeed(content)) {
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

export async function jsonFeedResponse(
  request: Request,
  checkSubscription = true,
  itemSlug?: string,
  itemStatuses: number[] = [STATUSES.PUBLISHED, STATUSES.UNLISTED],
): Promise<Response> {
  const itemId = itemSlug ? getIdFromSlug(itemSlug) : undefined;
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
    : {});
  const unavailable = feedUnavailable(loaded.content);
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
  return jsonResponse(loaded.publicFeed, {
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json;charset=UTF-8",
    },
  });
}

export async function rssFeedResponse(
  request: Request,
  itemSlug?: string,
): Promise<Response> {
  const itemId = itemSlug ? getIdFromSlug(itemSlug) : undefined;
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
  const loaded = await loadPublishedFeed(env, request, {limit: 1});
  const theme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
  );
  return new Response(theme.getRssStylesheet().stylesheet, {
    headers: {"content-type": "text/xsl"},
  });
}

export async function sitemapResponse(request: Request): Promise<Response> {
  const loaded = await loadPublishedFeed(env, request, {
    limit: -1,
  });
  const unavailable = feedUnavailable(loaded.content);
  if (unavailable) {
    return unavailable;
  }
  const redirect = onboardingRedirect(request, loaded.onboarding.requiredOk);
  if (redirect) {
    return redirect;
  }
  const feed = loaded.publicFeed;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
    'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
  xml += `<url><loc>${escapeHtml(String(feed.home_page_url ?? ""))}</loc>`;
  if (feed.icon) {
    xml += `<image:image><image:loc>${escapeHtml(feed.icon)}</image:loc></image:image>`;
  }
  xml += "</url>";
  for (const item of feed.items) {
    const extra = item._microfeed ?? {};
    xml += `<url><loc>${escapeHtml(String(extra.web_url ?? ""))}</loc>`;
    if (item.date_published) {
      xml += `<lastmod>${escapeHtml(String(item.date_published))}</lastmod>`;
    }
    const attachments = Array.isArray(item.attachments)
      ? item.attachments as Array<Record<string, unknown>>
      : [];
    for (const attachment of attachments) {
      const mimeType = String(attachment.mime_type ?? "");
      const url = escapeHtml(String(attachment.url ?? ""));
      if (mimeType.startsWith("image/")) {
        xml += `<image:image><image:loc>${url}</image:loc></image:image>`;
      } else if (mimeType.startsWith("video/")) {
        xml += "<video:video>" +
          `<video:title>${escapeHtml(String(item.title ?? ""))}</video:title>` +
          (
            item.date_published
              ? `<video:publication_date>${escapeHtml(String(item.date_published))}</video:publication_date>`
              : ""
          ) +
          `<video:content_loc>${url}</video:content_loc>` +
          "</video:video>";
      }
    }
    xml += "</url>";
  }
  xml += "</urlset>";
  return new Response(xml, {headers: {"content-type": "text/xml"}});
}

export function publicFeedHead(): Response {
  return new Response("ok");
}
