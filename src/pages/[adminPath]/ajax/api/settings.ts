import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {updateApiAccessSettings} from "@/server/api/api-keys";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";
import FeedDb from "@/server/feed/FeedDb";
import {jsonResponse} from "@/server/http";
import {apiSettingsCommandSchema} from "@/shared/ApiSchemas";

export const POST: APIRoute = async ({request}) => {
  const parsed = apiSettingsCommandSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid API settings."}, {status: 400});
  }
  const settings = await updateApiAccessSettings(env.FEED_DB, parsed.data);
  await new FeedDb(env, request, cache).purgePublicCacheTags([
    PUBLIC_CACHE_TAGS.SITE_FILES,
  ]);
  return jsonResponse({settings});
};
