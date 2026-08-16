export type WebhookQuickstartLanguage = "javascript" | "python";

export const WEBHOOK_QUICKSTART_ENDPOINT_URL =
  "http://127.0.0.1:3000/webhook";

export const JAVASCRIPT_WEBHOOK_RECEIVER = String.raw`const express = require("express");
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
`;

export const PYTHON_WEBHOOK_RECEIVER = String.raw`import json
import os

from flask import Flask, request
from standardwebhooks.webhooks import Webhook

secret = os.environ.get("MICROFEED_WEBHOOK_SECRET")
if not secret:
    raise RuntimeError("Set MICROFEED_WEBHOOK_SECRET before starting the receiver.")

app = Flask(__name__)
verifier = Webhook(secret)
seen_delivery_ids = set()


@app.post("/webhook")
def receive_webhook():
    raw_body = request.get_data(cache=False, as_text=False)
    try:
        event = verifier.verify(
            raw_body,
            {
                "webhook-id": request.headers.get("webhook-id", ""),
                "webhook-signature": request.headers.get("webhook-signature", ""),
                "webhook-timestamp": request.headers.get("webhook-timestamp", ""),
            },
        )
    except Exception:
        return "Invalid webhook signature.", 401

    delivery_id = request.headers.get("webhook-id", "")
    duplicate = delivery_id in seen_delivery_ids
    seen_delivery_ids.add(delivery_id)
    if len(seen_delivery_ids) > 10000:
        seen_delivery_ids.pop()

    print(
        json.dumps(
            {
                "delivery_id": delivery_id,
                "duplicate": duplicate,
                "event_type": event.get("type"),
                "test": event.get("test"),
                "payload": event,
            },
            indent=2,
        ),
        flush=True,
    )

    if event.get("test") is True:
        print("Test event accepted; production effects were skipped.", flush=True)
    else:
        print(
            "Real event accepted; this local inspector has no production effects.",
            flush=True,
        )

    return "", 204


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000)
`;

export const WEBHOOK_QUICKSTARTS = {
  javascript: {
    directoryCommand: "cd .microfeed/webhooks/endpoint1",
    filename: "server.cjs",
    installCommands: ["yarn install"],
    label: "JavaScript",
    runCommand: "MICROFEED_WEBHOOK_SECRET=whsec_... yarn start",
    scaffoldCommand:
      "yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 --language javascript",
    source: JAVASCRIPT_WEBHOOK_RECEIVER,
  },
  python: {
    directoryCommand: "cd .microfeed/webhooks/endpoint1",
    filename: "server.py",
    installCommands: [
      "python3 -m venv .venv",
      ". .venv/bin/activate",
      "pip install -r requirements.txt",
    ],
    label: "Python",
    runCommand: "MICROFEED_WEBHOOK_SECRET=whsec_... python server.py",
    scaffoldCommand:
      "yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 --language python",
    source: PYTHON_WEBHOOK_RECEIVER,
  },
} as const;

export const WEBHOOK_OPENAPI_CODE_SAMPLES = [
  {
    label: "Express receiver",
    lang: "JavaScript",
    source: JAVASCRIPT_WEBHOOK_RECEIVER,
  },
  {
    label: "Flask receiver",
    lang: "Python",
    source: PYTHON_WEBHOOK_RECEIVER,
  },
] as const;
