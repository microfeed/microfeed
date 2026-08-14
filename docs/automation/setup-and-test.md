---
title: Set up and test an automation
description: Enable Queue-backed webhooks, create an endpoint, run the local listener, and verify a real content event.
---

## 1. Enable the API and webhooks

In **Admin → API → API Settings**, enable API access and public API docs. Create
a separately named integration credential for this automation. Give it only the
read or write permissions the workflow requires; do not reuse a human or
unrelated service credential.

Webhooks require an explicit deployment opt-in:

```console
yarn manage deploy --enable-webhooks --instance <name>
```

For an isolated preview or local simulation:

```console
yarn manage deploy --preview --enable-webhooks --instance <name>
yarn manage deploy --local --enable-webhooks --instance <name>
```

An ordinary deployment does not request Queue permission or create a Queue.
Production and preview use distinct Queues; local development uses Wrangler's
Queue simulation.

## 2. Start the local listener

Run the site locally, then start a second terminal:

```console
yarn microfeed webhook listen
```

The listener binds only `127.0.0.1:8978/webhook`. Paste the endpoint signing
secret into its hidden prompt. You can instead use
`MICROFEED_WEBHOOK_SECRET` or `--secret-file`; there is deliberately no
plaintext `--secret` option.

To test a receiver already listening on another loopback port:

```console
yarn microfeed webhook listen \
  --secret-file .webhook-secret \
  --forward-to http://127.0.0.1:3000/hooks/microfeed
```

The listener verifies the exact request bytes, prints the event, then forwards
the same bytes and webhook headers. Without a forward target it returns `204`.
Use `--json` for one NDJSON record per delivery.

## 3. Create and test the endpoint

Open **Admin → Webhooks → Endpoints**. Create an endpoint for
`http://127.0.0.1:8978/webhook`, choose one or more events, and immediately copy
the signing secret. It cannot be revealed later.

Select **Test**. The listener should print a verified `webhook.test` event, and
**Webhooks → Deliveries** should show a successful attempt. Next, create or
publish a real item covered by the endpoint subscription and inspect that
delivery's payload, correlation chain, response status, and attempts.

## Limits and recovery

- At most 20 non-deleted endpoints may exist. Disabled and auto-paused
  endpoints count; deletion frees a slot.
- At most 1,000 new deliveries are reserved per UTC day. If a complete fanout
  does not fit, every matching delivery is recorded as `suppressed_budget`.
- A delivery has six total attempts: immediately, then approximately 1 minute,
  5 minutes, 30 minutes, 2 hours, and 8 hours later.
- Network errors, timeouts, `408`, `425`, `429`, and `5xx` retry. Redirects and
  other `4xx` responses are terminal.
- Delivery IDs can repeat because Queues are at-least-once. Deduplicate them,
  but make handling idempotent too.
- Rotate a secret in Admin. The prior secret is retained encrypted for a
  24-hour transition window; update the receiver promptly and never log either
  value.
- After 10 consecutive terminal failures, microfeed pauses the endpoint and
  cancels pending deliveries. Fix it, send a successful test while paused, then
  explicitly resume it.

Continue with [Build webhook-driven AI agents](../ai-agents/).
