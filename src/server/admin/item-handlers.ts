import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {normalizeAdminItemListLimit} from "@/shared/AdminCollections";
import {jsonResponse} from "@/server/http";
import {listAdminItems} from "@/server/items/admin-list";

export const listAdminItemSummaries: APIRoute = async ({request}) => {
  const url = new URL(request.url);
  return jsonResponse(
    await listAdminItems(env.FEED_DB, request, {
      limit: normalizeAdminItemListLimit(url.searchParams.get("limit")),
    }),
    {headers: {"cache-control": "private, no-store"}},
  );
};
