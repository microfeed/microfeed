import type {APIRoute} from "astro";

import {STATUSES} from "@/shared/Constants";
import {apiItemInputSchema} from "@/shared/ApiSchemas";
import {getIdFromSlug} from "@/shared/StringUtils";
import {jsonResponse} from "../../../../server/http";
import {jsonFeedResponse} from "@/server/feed/responses";
import {deleteItem, updateItem} from "@/server/items/service";

export const GET: APIRoute = ({params, request}) =>
  jsonFeedResponse(
    request,
    false,
    params.itemId,
    [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
    false,
  );

export const DELETE: APIRoute = async ({locals, params}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  if (!await deleteItem(locals.feedDb, locals.feedCrud, itemId)) {
    return jsonResponse({error: "Item not found."}, {status: 404});
  }
  return jsonResponse({});
};

export const PUT: APIRoute = async ({locals, params, request}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid item."}, {status: 400});
  }
  const item = await updateItem(
    locals.feedDb,
    locals.feedCrud,
    itemId,
    parsed.data,
  );
  if (!item) {
    return jsonResponse({error: "Item not found."}, {status: 404});
  }
  const publicFeed = await locals.feedDb.getPublicJsonData({
    ...locals.feedCrud.feedContent,
    items: [item],
  }, true) as {items?: unknown[]};
  return jsonResponse(publicFeed.items?.[0] ?? {});
};
