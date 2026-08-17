const express = require("express");
const {Webhook} = require("standardwebhooks");

const secret = process.env.MICROFEED_WEBHOOK_SECRET;
if (!secret) {
  throw new Error("Set MICROFEED_WEBHOOK_SECRET before starting the receiver.");
}

const app = express();
const verifier = new Webhook(secret);
const seenDeliveryIds = new Set();

app.post(
  "/webhook",
  express.raw({limit: "256kb", type: "application/json"}),
  (request, response) => {
    let event;
    try {
      event = verifier.verify(request.body, {
        "webhook-id": request.get("webhook-id") || "",
        "webhook-signature": request.get("webhook-signature") || "",
        "webhook-timestamp": request.get("webhook-timestamp") || "",
      });
    } catch {
      response.status(401).send("Invalid webhook signature.");
      return;
    }

    const deliveryId = request.get("webhook-id");
    const duplicate = seenDeliveryIds.has(deliveryId);
    seenDeliveryIds.add(deliveryId);
    if (seenDeliveryIds.size > 10000) {
      seenDeliveryIds.delete(seenDeliveryIds.values().next().value);
    }

    console.log(JSON.stringify({
      delivery_id: deliveryId,
      duplicate,
      event_type: event.type,
      test: event.test,
      payload: event,
    }, null, 2));

    if (event.test === true) {
      console.log("Test event accepted; production effects were skipped.");
    } else {
      console.log("Real event accepted; this local inspector has no production effects.");
    }

    response.status(204).end();
  },
);

app.listen(3000, "127.0.0.1", () => {
  console.log("Listening at http://127.0.0.1:3000/webhook");
});
