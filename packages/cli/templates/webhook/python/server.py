import json
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
