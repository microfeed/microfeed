import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {updateApiAccessSettings} from "@/server/api/api-keys";
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
  return jsonResponse({settings});
};
