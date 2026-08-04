import {env, waitUntil} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {scheduleBestEffortMediaDeletion} from "@/server/media/deletions";
import {mediaBucket} from "@/server/media/storage";
import {jsonResponse} from "../../../server/http";
import type {FeedContent} from "../../../types";

export async function updateAdminFeed(
  request: Request,
  runtimeEnv: Env,
  schedule: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const updatedFeed = await request.json() as FeedContent;
  const deleteImageUrls = Array.isArray(updatedFeed.deleteImageUrls)
    ? updatedFeed.deleteImageUrls
    : [];
  const database = new FeedDb(runtimeEnv, request);
  await database.putContent(updatedFeed);
  scheduleBestEffortMediaDeletion(
    mediaBucket(runtimeEnv),
    deleteImageUrls,
    schedule,
  );
  return jsonResponse({});
}

export const POST: APIRoute = async ({request}) =>
  updateAdminFeed(request, env, waitUntil);
