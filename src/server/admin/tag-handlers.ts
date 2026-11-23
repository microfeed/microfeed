import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {
  createApiTag,
  deleteApiTag,
  getApiTag,
  listApiTags,
  updateApiTag,
} from "@/server/tags/handlers";

function adminTagHandler(handler: APIRoute): APIRoute {
  return (context) => {
    // Authenticated Admin AJAX requests skip the middleware's feed loading.
    context.locals.feedDb = new FeedDb(env, context.request, cache);
    return handler(context);
  };
}

export const listAdminTags = adminTagHandler(listApiTags);
export const createAdminTag = adminTagHandler(createApiTag);
export const getAdminTag = adminTagHandler(getApiTag);
export const updateAdminTag = adminTagHandler(updateApiTag);
export const deleteAdminTag = adminTagHandler(deleteApiTag);
