import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import {apiTagCreateInputSchema, apiTagInputSchema} from "@/shared/ApiSchemas";
import {TagRequestError, TagConflictError} from "@/shared/Tags";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";
import {jsonResponse} from "@/server/http";
import {contentMutationWebhookCommit} from "@/server/webhooks/emission";
import {deleteTag, getTag, listTags, saveTag} from "./service";

function handler(method: "GET" | "POST" | "PUT" | "DELETE"): APIRoute {
  return async ({locals, params, request}) => {
    if (!locals.feedDb) return new Response("Feed context unavailable", {status: 500});
    const database: D1Database = locals.feedDb.FEED_DB;
    const origin = new URL(request.url).origin;
    const reference = params.slug ?? params.tagId;
    try {
      if (method === "GET" && !reference) {
        const query = new URL(request.url).searchParams;
        return jsonResponse(await listTags(database, origin, Number(query.get("limit") ?? 20), query.get("next_cursor") ?? undefined));
      }
      const before = reference ? await getTag(database, origin, reference, Boolean(params.tagId)) : null;
      if (reference && !before) return jsonResponse({error: "Tag not found."}, {status: 404});
      if (method === "GET") return jsonResponse(before);
      const commit = contentMutationWebhookCommit(env, request, {
        before: before ? {...before} : null,
        context: {origin: new URL(request.url).pathname.startsWith("/api/") ? "api" : "dashboard"},
        id: (tag: import("@/shared/Tags").TagRecord) => tag.id,
        mapResult: tag => ({...tag}), kind: "tag",
        mutation: method === "POST" ? "created" : method === "DELETE" ? "deleted" : "updated",
      });
      if (method === "DELETE" && before) {
        await deleteTag(database, before, commit);
        await locals.feedDb.purgePublicCacheTags([PUBLIC_CACHE_TAGS.PUBLIC]);
        return jsonResponse({});
      }
      const schema = method === "POST" ? apiTagCreateInputSchema : apiTagInputSchema;
      const parsed = schema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return jsonResponse({error: parsed.error.issues[0]?.message ?? "Invalid tag.", field: parsed.error.issues[0]?.path[0]}, {status: 400});
      const tag = await saveTag(database, origin, parsed.data, before ?? undefined, commit);
      await locals.feedDb.purgePublicCacheTags([PUBLIC_CACHE_TAGS.PUBLIC]);
      return jsonResponse(tag, {status: method === "POST" ? 201 : 200});
    } catch (error) {
      if (error instanceof TagRequestError) return jsonResponse({error: error.message, field: error.field}, {status: 400});
      if (error instanceof TagConflictError) return jsonResponse({error: error.message}, {status: 409});
      throw error;
    }
  };
}
export const listApiTags = handler("GET");
export const createApiTag = handler("POST");
export const getApiTag = handler("GET");
export const updateApiTag = handler("PUT");
export const deleteApiTag = handler("DELETE");
