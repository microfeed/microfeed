import {cache, env, waitUntil} from "cloudflare:workers";
import type {APIRoute} from "astro";

import FeedDb from "@/server/feed/FeedDb";
import {scheduleBestEffortMediaDeletion} from "@/server/media/deletions";
import {mediaBucket} from "@/server/media/storage";
import {jsonResponse} from "../../../server/http";
import type {FeedContent} from "../../../types";
import type {PublicCachePurger} from "@/server/cache/public-cache";
import {STATUSES} from "@/shared/Constants";
import {webhookChannelSnapshot} from "@/shared/WebhookExamples";
import {
  changedWebhookFields,
  contentMutationWebhookInputs,
  webhookItemObject,
} from "@/server/webhooks/emission";
import {commitMutationWithWebhookEvents} from "@/server/webhooks/events";
import {
  isUnpublishedStatus,
  isWebMcpInteraction,
} from "@/shared/WebMcp";

export async function updateAdminFeed(
  request: Request,
  runtimeEnv: Env,
  schedule: (promise: Promise<unknown>) => void,
  publicCachePurger?: PublicCachePurger,
): Promise<Response> {
  const updatedFeed = await request.json().catch(() => null) as
    | FeedContent
    | null;
  if (!updatedFeed || typeof updatedFeed !== "object") {
    return jsonResponse({error: "Send a valid feed update."}, {status: 400});
  }
  const webMcpInteraction = isWebMcpInteraction(request);
  const updatedItemId = updatedFeed.item?.id;
  if (
    webMcpInteraction &&
    (typeof updatedItemId !== "string" || !updatedItemId.trim())
  ) {
    return jsonResponse({error: "Choose an Item draft to save."}, {status: 400});
  }
  if (webMcpInteraction && (
    !updatedFeed.item || updatedFeed.channel || updatedFeed.settings ||
    !isUnpublishedStatus(updatedFeed.item.status)
  )) {
    return jsonResponse({
      error: "WebMCP can save only an unpublished Item draft.",
    }, {status: 409});
  }
  const deleteImageUrls = Array.isArray(updatedFeed.deleteImageUrls)
    ? updatedFeed.deleteImageUrls
    : [];
  const database = new FeedDb(runtimeEnv, request, publicCachePurger);
  const [beforeItem, beforeChannelContent] = await Promise.all([
    updatedItemId ? database.getItemById(updatedItemId) : null,
    updatedFeed.channel ? database.getContent(null) : null,
  ]);
  if (
    webMcpInteraction && beforeItem &&
    !isUnpublishedStatus(beforeItem.status)
  ) {
    return jsonResponse({
      error: "WebMCP cannot change an Item that is no longer unpublished.",
    }, {status: 409});
  }
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
      const before = webhookChannelSnapshot(
        (beforeChannelContent?.channel ?? {}) as Record<string, unknown>,
      );
      const after = webhookChannelSnapshot(
        updatedFeed.channel as Record<string, unknown>,
      );
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
      {origin: webMcpInteraction ? "webmcp" : "dashboard"},
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
