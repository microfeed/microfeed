import {handle} from "@astrojs/cloudflare/handler";

import {processWebhookMessage, type WebhookQueueMessage} from "@/server/webhooks/delivery";
import {
  enqueueUnqueuedWebhookDeliveries,
  pruneWebhookHistory,
} from "@/server/webhooks/events";

export default {
  fetch(request, runtimeEnv, context) {
    return handle(request, runtimeEnv, context);
  },
  async queue(batch, runtimeEnv) {
    for (const message of batch.messages) {
      try {
        await processWebhookMessage(runtimeEnv, message);
      } catch (error) {
        console.error(JSON.stringify({
          deliveryId: message.body?.deliveryId,
          error: error instanceof Error ? error.message : String(error),
          message: "Unhandled webhook consumer error",
        }));
        message.retry();
      }
    }
  },
  async scheduled(_controller, runtimeEnv) {
    if (!runtimeEnv.WEBHOOK_QUEUE) return;
    await enqueueUnqueuedWebhookDeliveries(runtimeEnv);
    await pruneWebhookHistory(runtimeEnv.FEED_DB);
  },
} satisfies ExportedHandler<Env, WebhookQueueMessage>;
