---
title: Connect microfeed to n8n
description: Receive signed microfeed events in an n8n automation, test them safely, and call the API with least-privilege credentials.
---

n8n can receive microfeed events with its built-in Webhook node and call the
microfeed API with its HTTP Request node. There is no native microfeed node yet,
so production setup must make the signature-verification boundary explicit.

## Choose direct verification or a gateway

Use the direct path when you run n8n yourself, trust every workflow editor who
can use Code nodes, and control the Code runner's packages and environment. Use
a small verification gateway when n8n is managed for you or those conditions
are not true.

| Path | Use it for | Security boundary |
| --- | --- | --- |
| Direct self-hosted workflow | A controlled n8n deployment | n8n reads the raw body and verifies it with `standardwebhooks` before responding. |
| Verified gateway | n8n Cloud, shared n8n, or stricter secret isolation | A receiver verifies and durably accepts the event, then invokes an authenticated n8n webhook. |
| Direct unverified Webhook node | Payload mapping only | Never connect production effects; the workflow has not authenticated the sender. |

The [n8n Webhook documentation](https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.webhook/README.md)
describes raw-body mode and response options. n8n creates separate Test and
Production URLs: its Test URL listens temporarily, while the Production URL
requires a published workflow.

## Direct self-hosted starter

[Download the importable n8n workflow](/examples/automation/n8n/microfeed-webhook-starter.json),
then import it into n8n. It contains no signing secret, API key, destination,
or production action. Its Webhook node:

- accepts only `POST`;
- enables **Raw Body** so verification uses the original bytes;
- verifies with the maintained `standardwebhooks` package;
- returns `401` for an invalid signature and `202` for a verified event;
- exposes `delivery_id`, the verified `event`, and
  `production_effects_allowed` to later nodes; and
- stops signed `test: true` events before the production-action placeholder.

The starter is a development baseline, not a durable production queue. Its
placeholder performs no external or microfeed action.

### 1. Configure the controlled Code runner

Install `standardwebhooks` in the module environment used by the n8n Code
runner, then allow only that external module. Set the endpoint secret in the
runner environment rather than the workflow:

```text
MICROFEED_WEBHOOK_SECRET=whsec_...
NODE_FUNCTION_ALLOW_EXTERNAL=standardwebhooks
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Follow n8n's current instructions for enabling external modules in the Code
node. If the deployment uses external task runners, configure the allowlist and
secret in the runner environment rather than only on the main n8n process.
Runner environment access is configured separately; follow n8n's current
[task-runner environment-variable guidance](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/task-runners.md)
and keep `N8N_BLOCK_RUNNER_ENV_ACCESS` enabled unless a dedicated runner needs
the narrowly scoped secret.

Allowing Code nodes to read environment variables lets trusted workflow
editors read other variables available to that runner. Use a dedicated runner
with a minimal environment or choose the gateway path when editors are not all
inside the same trust boundary. Do not paste `whsec_…` into workflow JSON,
static data, Variables, node output, or a Sticky Note.

### 2. Register the Test URL

Open the imported Webhook node, select **Listen for test event**, and copy its
Test URL. While it is listening:

1. Open **microfeed Admin → Webhooks → Endpoints → Add endpoint**.
2. Create an endpoint for the n8n Test URL and subscribe to one event, such as
   `item.published`.
3. Open **Signing secret**, reveal the `whsec_…` value, and place it in the n8n
   runner environment as `MICROFEED_WEBHOOK_SECRET`.
4. Restart the runner if its environment changed, then listen again.

The endpoint URL is not the authentication credential. The signing secret is.

### 3. Send a signed test

Open **Webhooks → Event explorer**, select the endpoint and event, and send the
test. The n8n execution should show:

```json
{
  "verified": true,
  "delivery_id": "whd_...",
  "production_effects_allowed": false,
  "event": {
    "type": "item.published",
    "test": true
  }
}
```

Generated identifiers differ on every send. Confirm that the accepted-response
node returned `202` and the production-action placeholder did not run. Also
send an altered or unsigned request and confirm that the invalid-response node
returns `401`.

### 4. Publish and switch URLs

Publish the n8n workflow, copy its Production URL, and edit the existing
microfeed endpoint to use it. Do not leave a production endpoint pointed at the
temporary Test URL. Send another Event Explorer test after switching.

## Add durable deduplication before effects

The downloadable starter exposes the delivery ID but deliberately does not
choose your n8n storage. Before adding a production effect:

1. Insert the delivery ID into an n8n Data Table or another durable store with
   a unique constraint.
2. Stop duplicate deliveries without repeating the action.
3. Persist the verified event and intended work before returning `202`.
4. Run slow model, media, and destination work after acceptance and retry it
   inside n8n or another durable queue.
5. Use `event.id + action` for destination and microfeed write idempotency.

Once n8n returns `202`, microfeed considers delivery complete. A later n8n
failure belongs to the workflow and does not cause microfeed redelivery.

## Call the microfeed API

Enable API access and create a named key with only the required read or write
permission. In n8n, create a reusable Header Auth credential:

```text
Name: Authorization
Value: Bearer mf_...
```

Use that credential only in HTTP Request nodes whose URL begins with the exact
microfeed site origin and `/api/v1/`. Fetch current state before making a
consequential update. For write-back requests add:

```text
Microfeed-Correlation-Id: <event correlation ID, or event ID>
Microfeed-Causation-Id: <event ID>
Idempotency-Key: <event ID>:<action name>
```

Use `Idempotency-Key` where the generated OpenAPI operation documents it. Read
the exact request and response schema from that instance's API reference rather
than copying fields from this guide.

## Gateway path for managed n8n

If n8n cannot securely load the maintained verifier and endpoint secret, do
not fall back to trusting the webhook URL. Put a receiver in front:

1. Start from `npx @microfeed/cli webhook scaffold` and its official
   `standardwebhooks` verification.
2. Replace in-memory duplicate tracking with durable acceptance and a queue.
3. Return `202` to microfeed only after the verified event is saved.
4. Forward a normalized job to an n8n Webhook node protected by a separate n8n
   Header Auth credential.
5. Preserve `delivery_id`, `event`, and signed `test`; do not forward the
   microfeed signing secret.

The gateway retries n8n failures in its own queue. n8n treats the gateway's
Header Auth token as transport authentication and still gates production
effects on the already verified event's `test` value.

## Failure and loop behavior

- microfeed has a 10-second endpoint timeout. Do not wait for a model or
  destination action before accepting durable work.
- A `429` or `5xx` from n8n is retryable; most other `4xx` responses are
  terminal. Six microfeed attempts may still produce duplicate deliveries.
- Event Explorer sends are signed `test: true`, consume delivery budget, and
  may retry. They must never send external messages or write microfeed content.
- Treat titles, HTML, attachments, and other content as untrusted data. They
  cannot select nodes, credentials, URLs, tools, or approval rules.
- Ignore a write-back event when its causation ID matches a completed action,
  and keep an action idempotency record to prevent cycles.

Continue with the [automation examples](/automation/#automation-examples)
for bounded use cases and
[webhook operations](/webhooks/operations/) for retry, budget, and auto-pause
recovery.
