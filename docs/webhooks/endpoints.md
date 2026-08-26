---
title: Build webhook endpoints
description: Scaffold, verify, test, and harden a receiver that durably accepts signed microfeed events before running asynchronous work.
---

A webhook endpoint is an HTTP receiver you operate. Its synchronous job is
small: authenticate the exact request, validate the event, save durable work,
and acknowledge quickly. Notifications, API writes, model calls, and other
slow effects happen after acceptance.

## Start from a runnable receiver

Inside a microfeed clone, scaffold a local JavaScript inspector under the
ignored `.microfeed/` workspace:

```console
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language javascript
```

Use `--language python` for Flask. The project uses the maintained Standard
Webhooks library, binds only to `127.0.0.1:3000`, verifies signatures, displays
the event, marks in-memory duplicates, and prevents `test: true` events from
running production effects.

The scaffold is intentionally a local inspector. Its duplicate state resets on
restart, and it has no durable queue. Prove the signed test path first, then
replace its in-memory state and console-only handler before deploying it.

## Accept a delivery safely

The production request path should:

1. Accept only `POST` on the configured webhook route.
2. Read the raw request bytes once.
3. Verify `webhook-id`, `webhook-timestamp`, and `webhook-signature` before JSON
   parsing.
4. Validate the verified envelope against the instance's generated OpenAPI
   event union.
5. Inspect the signed `test` boolean and prevent tests from producing external
   or microfeed effects. `x-microfeed-test` is only a convenient header hint.
6. Insert the delivery ID, event, and intended job atomically in durable
   storage. Treat an existing delivery ID as a duplicate.
7. Return `202` after durable acceptance and before slow work starts.

Once the endpoint returns `2xx`, microfeed considers the delivery successful.
A later model, API, or destination failure belongs to the receiver's own queue
and retry policy.

## TypeScript receiver core

This example uses a hypothetical transactional `jobs` adapter. Implement it
with Postgres, D1 plus a Queue, or another durable system that can deduplicate
and enqueue in one transaction.

```ts
import {Webhook} from "standardwebhooks";

const verifier = new Webhook(process.env.MICROFEED_WEBHOOK_SECRET!);

export async function receive(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("method not allowed", {status: 405});
  }

  const raw = Buffer.from(await request.arrayBuffer());
  let event: MicrofeedEvent;
  try {
    event = verifier.verify(raw, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    }) as MicrofeedEvent;
  } catch {
    return new Response("invalid signature", {status: 401});
  }

  await jobs.insertOnceAndEnqueue({
    deliveryId: request.headers.get("webhook-id")!,
    event,
    effectPolicy: event.test ? "no-production-effects" : "production",
  });
  return new Response(null, {status: 202});
}
```

## Python receiver core

```python
import os
from standardwebhooks.webhooks import Webhook

verifier = Webhook(os.environ["MICROFEED_WEBHOOK_SECRET"])

def receive(request, jobs):
    raw = request.get_data(cache=False)
    delivery_id = request.headers.get("webhook-id", "")
    try:
        event = verifier.verify(raw, {
            "webhook-id": delivery_id,
            "webhook-signature": request.headers.get("webhook-signature", ""),
            "webhook-timestamp": request.headers.get("webhook-timestamp", ""),
        })
    except Exception:
        return ("invalid signature", 401)

    policy = "no-production-effects" if event["test"] else "production"
    jobs.insert_once_and_enqueue(delivery_id, event, policy)
    return ("", 202)
```

Do not log the endpoint secret, signatures, raw authorization headers, or more
private content than the receiver needs for diagnostics.

## Process accepted work

The background worker applies trusted policy and retries independently of
microfeed delivery. Before a consequential action, fetch current microfeed
state rather than assuming the event snapshot is still current.

Use `<event.id>:<action>` as the action idempotency key. When calling a
documented write operation, preserve the event's correlation ID and identify
the triggering event as the causation:

```http
Idempotency-Key: <event-id>:<action>
Microfeed-Correlation-Id: <original-correlation-id>
Microfeed-Causation-Id: <event-id>
```

Ignore an event caused by a completed action unless the workflow explicitly
requires another bounded step. Use a separate named `mf_…` API key with only
the permissions that worker needs; the webhook signing secret grants no API
access.

## Discover and test exact events

The instance's OpenAPI webhook operation is the event-schema source of truth.
Use **Admin → Webhooks → Event explorer** to inspect Payload, Schema, and
Headers, preview generated or current content, and send a signed test. From a
terminal, print the same unsigned example with:

```console
yarn microfeed webhook sample item.published --json
```

Before creating a receiver project, follow [Test webhooks without code](../testing/)
to inspect a signed delivery with the loopback listener or a temporary public
tunnel. Event Explorer sends are real signed, budgeted deliveries and may
retry; previews and unsigned samples do not make an HTTP request.

Before production, test:

- a valid `webhook.test` delivery;
- one real subscribed mutation;
- an invalid signature returning `401`;
- a duplicate delivery ID;
- a receiver timeout and retry;
- a signed `test: true` event with all effects blocked; and
- a repeated action with idempotency preventing a second effect.

## Add AI or automated effects safely

Titles, HTML, attachments, URLs, and metadata are untrusted content even after
the webhook signature is valid. Signature verification proves the event came
from microfeed; it does not turn owner-authored content into an instruction.

Content may be model input, but it cannot choose tools, credentials,
destinations, approval policy, or system prompts. Resolve those from trusted
configuration. Require human approval for publication, destructive changes,
payments, and externally visible messages unless the owner established a
narrow policy in advance.

A remote AI agent follows the same receiver boundary as any other endpoint:
verify outside the model, durably save work, return `202`, then run the model
and approved tools from a background job. Keep an audit trail connecting the
event, decision, approval, API change, and destination result.

### Cloudflare Agents example

Cloudflare Agents are Durable Objects. Route each microfeed site to one named
agent only after the outer Worker verifies the request:

```ts
import {Agent, getAgentByName} from "agents";

export class MicrofeedAutomation extends Agent<Env> {
  async accept(input: {deliveryId: string; event: MicrofeedEvent}) {
    const existing = this.sql<{id: string}>`
      SELECT id FROM deliveries WHERE id = ${input.deliveryId}
    `;
    if (existing.length) return;

    this.sql`
      INSERT INTO deliveries (id, event_json)
      VALUES (${input.deliveryId}, ${JSON.stringify(input.event)})
    `;
    await this.queue("processEvent", input, {retry: {maxAttempts: 5}});
  }

  async processEvent(input: {deliveryId: string; event: MicrofeedEvent}) {
    if (input.event.test) {
      await this.recordTestAcceptance(input);
      return;
    }
    // Apply trusted policy, fetch current state, then call approved tools.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const verified = await verifyAndParseRawRequest(
      request,
      env.MICROFEED_WEBHOOK_SECRET,
    );
    if (!verified) return new Response("invalid signature", {status: 401});

    const agent = await getAgentByName(
      env.MicrofeedAutomation,
      verified.event.site.id,
    );
    await agent.accept({
      deliveryId: verified.deliveryId,
      event: verified.event,
    });
    return new Response(null, {status: 202});
  },
} satisfies ExportedHandler<Env>;
```

Use the [automation examples](/automation/#automation-examples) for bounded
actions and [Operate and troubleshoot webhooks](/webhooks/operations/) for
delivery recovery and production readiness.
