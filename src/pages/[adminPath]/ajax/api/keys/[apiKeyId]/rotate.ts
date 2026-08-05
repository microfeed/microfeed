import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {rotateApiKey} from "@/server/api/api-keys";
import {jsonResponse} from "@/server/http";

export const POST: APIRoute = async ({params}) => {
  const id = params.apiKeyId ?? "";
  if (!id) {
    return jsonResponse({error: "Invalid API-key ID."}, {status: 400});
  }
  const apiKey = await rotateApiKey(env.FEED_DB, id);
  return apiKey
    ? jsonResponse({apiKey})
    : jsonResponse({error: "API key not found."}, {status: 404});
};
