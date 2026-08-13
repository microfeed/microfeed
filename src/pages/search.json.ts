import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {loadPublishedFeed, shouldHidePublicWeb} from "@/server/feed/feed";
import {
  ItemSearchRequestError,
  ItemSearchUnavailableError,
  searchContent,
} from "@/server/items/search";
import {themeSupportsPagesAndSearch} from "@/server/themes/Theme";

export const GET: APIRoute = async ({request}) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    return jsonResponse({error: "Use a search query between 2 and 200 characters."}, {
      headers: {"cache-control": "private, no-store"},
      status: 400,
    });
  }
  const loaded = await loadPublishedFeed(env, request, {
    includeActiveTheme: true,
    limit: 1,
  });
  if (
    shouldHidePublicWeb(loaded.content) ||
    !themeSupportsPagesAndSearch(loaded.content.activeTheme)
  ) {
    return jsonResponse({error: "Not found."}, {status: 404});
  }
  try {
    const response = await searchContent(loaded.database.FEED_DB, request, {
      fields: ["title", "content"],
      limit: 12,
      publicBucketUrl:
        loaded.content.settings?.webGlobalSettings?.publicBucketUrl,
      query,
      statuses: ["published"],
      types: ["item", "page"],
    });
    return jsonResponse({
      items: response.items.map((item) => ({
        content_text: item.content_text,
        date_published: item.date_published,
        highlights: item.highlights,
        id: item.id,
        title: item.title,
        type: item.type,
        url: item.web_url,
      })),
    }, {headers: {"cache-control": "private, no-store"}});
  } catch (error) {
    if (error instanceof ItemSearchRequestError) {
      return jsonResponse({error: error.message}, {status: 400});
    }
    if (error instanceof ItemSearchUnavailableError) {
      return jsonResponse({error: error.message}, {status: 503});
    }
    throw error;
  }
};
