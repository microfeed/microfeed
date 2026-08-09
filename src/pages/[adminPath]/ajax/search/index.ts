import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {adminUrl} from "@/shared/AdminPath";
import type {ItemSearchStatus} from "@/shared/ItemSearch";
import FeedDb from "@/server/feed/FeedDb";
import {
  ItemSearchRequestError,
  ItemSearchUnavailableError,
  latestItems,
  searchItems,
} from "@/server/items/search";
import {jsonResponse} from "@/server/http";

const ALL_STATUSES: ItemSearchStatus[] = [
  "published",
  "unlisted",
  "unpublished",
];

export async function getAdminItemSearch(
  request: Request,
  runtimeEnv: Env,
  adminPath: string,
): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const database = new FeedDb(runtimeEnv, request);
  try {
    const items = query.length >= 2
      ? (await searchItems(database.FEED_DB, request, {
          fields: ["title"],
          limit: 5,
          query,
          statuses: ALL_STATUSES,
        })).items
      : query.length === 0
      ? await latestItems(database.FEED_DB, request, 5)
      : [];
    return jsonResponse({
      items: items.map((item) => ({
        edit_url: adminUrl(`items/${item.id}`, adminPath),
        highlights: item.highlights.title,
        id: item.id,
        match_type: item.match_type,
        status: item.status,
        title: item.title,
        updated_at: item.date_modified,
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
}

export const GET: APIRoute = ({params, request}) =>
  getAdminItemSearch(request, env, params.adminPath ?? "admin");
