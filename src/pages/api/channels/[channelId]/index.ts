import type {APIRoute} from "astro";

import {jsonResponse} from "../../../../server/http";

export const PUT: APIRoute = async ({locals, params, request}) => {
  if (params.channelId !== "primary") {
    return jsonResponse({error: "Invalid channel id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  await locals.feedCrud.upsertChannel(await request.json());
  return jsonResponse({});
};
