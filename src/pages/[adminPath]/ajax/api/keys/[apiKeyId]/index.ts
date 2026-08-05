import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  ApiKeyNameConflictError,
  renameApiKey,
  revokeApiKey,
} from "@/server/api/api-keys";
import {jsonResponse} from "@/server/http";
import {renameApiKeyCommandSchema} from "@/shared/ApiSchemas";

export const PATCH: APIRoute = async ({params, request}) => {
  const id = params.apiKeyId ?? "";
  const parsed = renameApiKeyCommandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!id || !parsed.success) {
    return jsonResponse({error: "Enter a valid API-key name."}, {status: 400});
  }
  try {
    const apiKey = await renameApiKey(env.FEED_DB, id, parsed.data.name);
    return apiKey
      ? jsonResponse({apiKey})
      : jsonResponse({error: "API key not found."}, {status: 404});
  } catch (error) {
    if (error instanceof ApiKeyNameConflictError) {
      return jsonResponse({error: error.message}, {status: 409});
    }
    throw error;
  }
};

export const DELETE: APIRoute = async ({params}) => {
  const id = params.apiKeyId ?? "";
  if (!id) {
    return jsonResponse({error: "Invalid API-key ID."}, {status: 400});
  }
  return await revokeApiKey(env.FEED_DB, id)
    ? jsonResponse({})
    : jsonResponse({error: "API key not found."}, {status: 404});
};
