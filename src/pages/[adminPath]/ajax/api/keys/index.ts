import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  ApiKeyNameConflictError,
  createApiKey,
  readApiAccessSettings,
} from "@/server/api/api-keys";
import {jsonResponse} from "@/server/http";
import {createApiKeyCommandSchema} from "@/shared/ApiSchemas";

export const POST: APIRoute = async ({request}) => {
  const parsed = createApiKeyCommandSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Enter a valid, unique API-key name."}, {
      status: 400,
    });
  }
  const settings = parsed.data.settings ??
    await readApiAccessSettings(env.FEED_DB);
  if (!settings.enabled) {
    return jsonResponse({
      error: "Enable API access before creating an API key.",
    }, {status: 409});
  }
  try {
    const apiKey = await createApiKey(env.FEED_DB, {
      name: parsed.data.name,
      settings: parsed.data.settings,
    });
    return jsonResponse({apiKey, settings}, {status: 201});
  } catch (error) {
    if (error instanceof ApiKeyNameConflictError) {
      return jsonResponse({error: error.message}, {status: 409});
    }
    throw error;
  }
};
