# microfeed webhook receiver — Python

This loopback-only Flask server verifies and displays signed microfeed
webhooks. It is a local development inspector, not a production receiver: its
duplicate state resets on restart, it has no durable queue, and it performs no
production side effects.

The generated server will provide the local endpoint
`http://127.0.0.1:3000/webhook` after it starts. Set it up in this order:

1. In microfeed Admin, open **Webhooks → Endpoints → Add endpoint** and create
   that URL.
2. Copy the one-time `whsec_…` signing secret. This is your
   `MICROFEED_WEBHOOK_SECRET`.
3. Install dependencies and run the receiver with that secret:

   ```console
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   MICROFEED_WEBHOOK_SECRET=whsec_... python server.py
   ```

4. With the receiver running, send a signed test from **Webhooks → Event
   explorer**.

`.env.example` documents the required variable name. Never commit a populated
secret file or paste the secret into source code or the endpoint URL.

Before production, durably save the delivery ID and work in one transaction,
acknowledge quickly, process in a background queue, and add action idempotency,
loop prevention, approval rules, audit logs, and cost alerts.
