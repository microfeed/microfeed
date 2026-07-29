import type {APIRoute} from "astro";

import {
  ITEM_STATUSES_STRINGS_DICT,
  STATUSES,
} from "@/shared/Constants";
import {getIdFromSlug} from "@/shared/StringUtils";
import {jsonResponse} from "../../../../server/http";
import {jsonFeedResponse} from "@/server/feed/responses";

interface ApiItem extends Record<string, unknown> {
  _microfeed?: {status?: string};
  date_published?: string;
  date_published_ms?: number;
  status?: number | string;
}

export const GET: APIRoute = ({params, request}) =>
  jsonFeedResponse(
    request,
    false,
    params.itemId,
    [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
  );

export const DELETE: APIRoute = async ({locals, params}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  await locals.feedCrud.upsertItem({
    date_published_ms: Date.now(),
    id: itemId,
    status: STATUSES.DELETED,
  });
  return jsonResponse({});
};

export const PUT: APIRoute = async ({locals, params, request}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }

  const existingResponse = await jsonFeedResponse(
    request,
    false,
    params.itemId,
    [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
  );
  if (!existingResponse.ok) {
    return existingResponse;
  }
  const existingFeed = await existingResponse.json() as {items?: ApiItem[]};
  const oldItem = existingFeed.items?.[0];
  if (!oldItem) {
    return new Response("Not Found", {status: 404});
  }

  const input = await request.json() as ApiItem;
  const item: ApiItem = {...oldItem, ...input};
  if (!input.date_published_ms) {
    item.date_published_ms = input.date_published
      ? new Date(input.date_published).getTime()
      : Date.now();
  }
  const requestedStatus = String(input.status ?? "");
  const oldStatus = oldItem._microfeed?.status ?? "";
  const statusByName: Readonly<Record<string, number>> =
    ITEM_STATUSES_STRINGS_DICT;
  item.status = statusByName[requestedStatus] ??
    statusByName[oldStatus] ??
    STATUSES.PUBLISHED;

  await locals.feedCrud.upsertItem({id: itemId, ...item});
  return jsonResponse({});
};
