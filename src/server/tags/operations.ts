import {contentResult, type ContentOperation} from "@/server/content/operation";
import {env} from "cloudflare:workers";
import {apiTagCreateInputSchema, apiTagInputSchema} from "@/shared/ApiSchemas";
import {TagRequestError, TagConflictError} from "@/shared/Tags";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";
import {contentMutationWebhookCommit} from "@/server/webhooks/emission";
import {deleteTag, getTag, listTags, saveTag} from "./service";

function handler(method: "GET" | "POST" | "PUT" | "DELETE"): ContentOperation {
  return async (context) => {
    const {locals, params, request} = context;
    if (!locals.feedDb) return contentResult({error: "Feed context unavailable"}, {status: 500});
    const database: D1Database = locals.feedDb.FEED_DB;
    const origin = new URL(request.url).origin;
    const reference = params.slug ?? params.tagId;
    try {
      if (method === "GET" && !reference) {
        const query = context.query;
        return contentResult(await listTags(database, origin, Number(query.get("limit") ?? 20), query.get("next_cursor") ?? undefined));
      }
      const before = reference ? await getTag(database, origin, reference, Boolean(params.tagId)) : null;
      if (reference && !before) return contentResult({error: "Tag not found."}, {status: 404});
      if (method === "GET") return contentResult(before);
      const commit = contentMutationWebhookCommit(env, request, {
        before: before ? {...before} : null,
        context: {origin: context.origin},
        id: (tag: import("@/shared/Tags").TagRecord) => tag.id,
        mapResult: tag => ({...tag}), kind: "tag",
        mutation: method === "POST" ? "created" : method === "DELETE" ? "deleted" : "updated",
      });
      if (method === "DELETE" && before) {
        await deleteTag(database, before, commit);
        await locals.feedDb.purgePublicCacheTags([PUBLIC_CACHE_TAGS.PUBLIC]);
        return contentResult({});
      }
      const schema = method === "POST" ? apiTagCreateInputSchema : apiTagInputSchema;
      const parsed = schema.safeParse(context.input);
      if (!parsed.success) return contentResult({error: parsed.error.issues[0]?.message ?? "Invalid tag.", field: parsed.error.issues[0]?.path[0]}, {status: 400});
      const tag = await saveTag(database, origin, parsed.data, before ?? undefined, commit);
      await locals.feedDb.purgePublicCacheTags([PUBLIC_CACHE_TAGS.PUBLIC]);
      return contentResult(tag, {status: method === "POST" ? 201 : 200});
    } catch (error) {
      if (error instanceof TagRequestError) return contentResult({error: error.message, field: error.field}, {status: 400});
      if (error instanceof TagConflictError) return contentResult({error: error.message}, {status: 409});
      throw error;
    }
  };
}
export const listTagsOperation = handler("GET");
export const createTagOperation = handler("POST");
export const getTagOperation = handler("GET");
export const updateTagOperation = handler("PUT");
export const deleteTagOperation = handler("DELETE");
