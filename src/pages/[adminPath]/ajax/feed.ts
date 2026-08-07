import {cache, env, waitUntil} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {scheduleBestEffortMediaDeletion} from "@/server/media/deletions";
import {mediaBucket} from "@/server/media/storage";
import {jsonResponse} from "../../../server/http";
import type {FeedContent} from "../../../types";
import type {PublicCachePurger} from "@/server/cache/public-cache";

export async function updateAdminFeed(
  request: Request,
  runtimeEnv: Env,
  schedule: (promise: Promise<unknown>) => void,
  publicCachePurger?: PublicCachePurger,
): Promise<Response> {
  const updatedFeed = await request.json() as FeedContent;
  const deleteImageUrls = Array.isArray(updatedFeed.deleteImageUrls)
    ? updatedFeed.deleteImageUrls
    : [];
  const database = new FeedDb(runtimeEnv, request, publicCachePurger);
  await database.putContent(updatedFeed);
  scheduleBestEffortMediaDeletion(
    mediaBucket(runtimeEnv),
    deleteImageUrls,
    schedule,
  );
  return jsonResponse({});
}

export const POST: APIRoute = async ({request}) =>
  updateAdminFeed(request, env, waitUntil, cache);
