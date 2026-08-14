import {cache, env, waitUntil} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {scheduleBestEffortMediaDeletion} from "@/server/media/deletions";
import {mediaBucket} from "@/server/media/storage";
import {jsonResponse} from "../../../server/http";
import type {FeedContent} from "../../../types";
import type {PublicCachePurger} from "@/server/cache/public-cache";
import {STATUSES} from "@/shared/Constants";
import {
  changedWebhookFields,
  contentMutationWebhookInputs,
  webhookItemObject,
} from "@/server/webhooks/emission";
import {commitMutationWithWebhookEvents} from "@/server/webhooks/events";

export async function updateAdminFeed(
  request: Request,
  runtimeEnv: Env,
  schedule: (promise: Promise<unknown>) => void,
  publicCachePurger?: PublicCachePurger,
): Promise<Response> {
  const updatedFeed = await request.json() as FeedContent;
  const deleteImageUrls = Array.isArray(updatedFeed.deleteImageUrls)
    ? updatedFeed.deleteImageUrls
    : [];
  const database = new FeedDb(runtimeEnv, request, publicCachePurger);
  const updatedItemId = updatedFeed.item?.id;
  const [beforeItem, beforeChannelContent] = await Promise.all([
    updatedItemId ? database.getItemById(updatedItemId) : null,
    updatedFeed.channel ? database.getContent(null) : null,
  ]);
  await database.putContent(updatedFeed, async (statements) => {
    const events = [];
    if (updatedItemId && updatedFeed.item) {
      const after = webhookItemObject(
        updatedFeed.item as unknown as Record<string, unknown>,
      );
      const mutation = !beforeItem
        ? "created"
        : updatedFeed.item.status === STATUSES.DELETED
        ? "deleted"
        : "updated";
      events.push(...contentMutationWebhookInputs({
        ...(mutation === "deleted"
          ? {before: webhookItemObject(beforeItem ?? after)}
          : {
              after,
              ...(beforeItem ? {before: webhookItemObject(beforeItem)} : {}),
            }),
        id: updatedItemId,
        kind: "item",
        mutation,
      }));
    }
    if (updatedFeed.channel) {
      const before = (beforeChannelContent?.channel ?? {}) as Record<
        string,
        unknown
      >;
      const after = updatedFeed.channel as Record<string, unknown>;
      const changedFields = changedWebhookFields(before, after);
      if (changedFields.length > 0) {
        events.push({
          changedFields,
          object: after,
          subjectId: "primary",
          subjectType: "channel" as const,
          type: "channel.updated" as const,
        });
      }
    }
    await commitMutationWithWebhookEvents(
      runtimeEnv,
      request,
      statements,
      events,
      {origin: "dashboard"},
    );
  });
  scheduleBestEffortMediaDeletion(
    mediaBucket(runtimeEnv),
    deleteImageUrls,
    schedule,
  );
  return jsonResponse({});
}

export const POST: APIRoute = async ({request}) =>
  updateAdminFeed(request, env, waitUntil, cache);
