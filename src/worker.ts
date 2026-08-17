import {handle} from "@astrojs/cloudflare/handler";

import {processWebhookMessage, type WebhookQueueMessage} from "@/server/webhooks/delivery";
import {
  runWebhookScheduledMaintenance,
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
  async scheduled(controller, runtimeEnv) {
    if (!runtimeEnv.WEBHOOK_QUEUE) return;
    await runWebhookScheduledMaintenance(runtimeEnv, controller.scheduledTime);
  },
} satisfies ExportedHandler<Env, WebhookQueueMessage>;
