import type {APIRoute} from "astro";

import {ITEM_STATUSES_STRINGS_DICT, STATUSES} from "@/shared/Constants";
import {datetimeLocalToMs} from "@/shared/TimeUtils";
import {jsonResponse} from "../../../server/http";

interface CreateItemPayload extends Record<string, unknown> {
  date_published_ms?: number;
  id?: string;
  status?: number | string;
}

export const POST: APIRoute = async ({locals, request}) => {
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const {id: _ignored, ...item} =
    await request.json() as CreateItemPayload;
  const statusByName: Readonly<Record<string, number>> =
    ITEM_STATUSES_STRINGS_DICT;
  item.status = statusByName[String(item.status ?? "")] ??
    STATUSES.PUBLISHED;
  item.date_published_ms = item.date_published_ms ??
    datetimeLocalToMs(new Date());
  const id = await locals.feedCrud.upsertItem(item);
  return jsonResponse({id}, {status: 201});
};
