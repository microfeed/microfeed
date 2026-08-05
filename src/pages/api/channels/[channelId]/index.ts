import type {APIRoute} from "astro";

import {apiChannelInputSchema} from "@/shared/ApiSchemas";
import {jsonResponse} from "../../../../server/http";

export const PUT: APIRoute = async ({locals, params, request}) => {
  if (params.channelId !== "primary") {
    return jsonResponse({error: "Invalid channel id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiChannelInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid channel."}, {status: 400});
  }
  await locals.feedCrud.upsertChannel(parsed.data);
  return jsonResponse({});
};
