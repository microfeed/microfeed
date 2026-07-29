import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {jsonResponse} from "../../../server/http";
import type {FeedContent} from "../../../types";

export const POST: APIRoute = async ({request}) => {
  const updatedFeed = await request.json() as FeedContent;
  const database = new FeedDb(env, request);
  await database.putContent(updatedFeed);
  return jsonResponse({});
};
