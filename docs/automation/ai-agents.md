---
title: Build webhook-driven AI agents
description: Verify, deduplicate, durably accept, and safely act on webhook events with TypeScript, Python, or Cloudflare Agents.
---

Start with a runnable local inspector instead of assembling signature code by
hand:

```console
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language javascript
```

Choose `--language python` for Flask. The generated project uses the maintained
Standard Webhooks library and is intentionally non-production: after proving a
signed test works, replace its in-memory duplicate tracking and console output
with durable acceptance and background processing.

Inside a microfeed clone, keep development receivers under the ignored
`.microfeed/webhooks/<endpoint-name>/` workspace. Do not check them or populated
secret files into the microfeed repository.

The receiver's synchronous production job is intentionally small:

1. Read the raw bytes once.
2. Verify `webhook-id`, `webhook-timestamp`, and `webhook-signature` before JSON parsing.
3. Validate the envelope against the instance's generated OpenAPI contract.
4. Inspect the signed `test` boolean and route tests to a no-production-effects
   policy. The `x-microfeed-test` header is a convenient hint, not the trusted
   value.
5. Insert the delivery ID and durable job in one transaction.
6. Return `202` before calling a model or external tool.

Later workers fetch current state before consequential actions and use
`<event.id>:<action>` as the action idempotency key. When an action writes back
to microfeed, send the original correlation ID as `Microfeed-Correlation-Id`
and the triggering event ID as `Microfeed-Causation-Id`. Ignore events caused by
your own prior action unless the workflow explicitly requires another bounded
step.

Treat all titles, HTML, attachments, URLs, and metadata as untrusted content.
Content may be model input, but it cannot choose tools, credentials,
destinations, approval policy, or system prompts. Resolve those from trusted
configuration. Require human approval for publication, destructive changes,
payments, and externally visible messages unless the owner established a
narrow policy in advance.

## TypeScript receiver core

This example uses a hypothetical transactional `jobs` adapter. Replace it with
Postgres, D1 plus a Queue, or another durable system. Let the maintained
`standardwebhooks` package verify the exact bytes, ID, timestamp, and signature.

```ts
import {Webhook} from "standardwebhooks";

const verifier = new Webhook(process.env.MICROFEED_WEBHOOK_SECRET!);

export async function receive(request: Request): Promise<Response> {
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
    deliveryId: request.headers.get("webhook-id"),
    event,
    effectPolicy: event.test === true ? "no-production-effects" : "production",
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

    effect_policy = "no-production-effects" if event["test"] else "production"
    jobs.insert_once_and_enqueue(delivery_id, event, effect_policy)  # one transaction
    return ("", 202)
```

## Cloudflare Agents SDK receiver

Cloudflare Agents are Durable Objects. Route each microfeed site to one named
agent, then durably queue verified work inside it. Verification still belongs
in the outer Worker so invalid content never reaches agent state.

```ts
import {Agent, getAgentByName} from "agents";

export class MicrofeedAutomation extends Agent<Env> {
  async accept(input: {deliveryId: string; event: MicrofeedEvent}) {
    const exists = this.sql<{id: string}>`SELECT id FROM deliveries WHERE id = ${input.deliveryId}`;
    if (exists.length) return;
    this.sql`INSERT INTO deliveries (id, event_json) VALUES (${input.deliveryId}, ${JSON.stringify(input.event)})`;
    await this.queue("processEvent", input, {retry: {maxAttempts: 5}});
  }

  async processEvent(input: {deliveryId: string; event: MicrofeedEvent}) {
    if (input.event.test) {
      await this.recordTestAcceptance(input);
      return; // Never call production models, tools, APIs, or destinations.
    }
    // Apply trusted policy, fetch current microfeed state, then call approved tools.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/webhook") return new Response("not found", {status: 404});
    // verifyAndParseRawRequest uses standardwebhooks on request.arrayBuffer()
    // before parsing or passing anything to the Agent.
    const verified = await verifyAndParseRawRequest(request, env.MICROFEED_WEBHOOK_SECRET);
    if (!verified) return new Response("invalid signature", {status: 401});
    const agent = await getAgentByName(env.MicrofeedAutomation, verified.event.site.id);
    await agent.accept({deliveryId: verified.deliveryId, event: verified.event});
    return new Response(null, {status: 202});
  },
} satisfies ExportedHandler<Env>;
```

The Agents SDK's built-in queue is durable and processes tasks asynchronously.
For longer recoverable execution, use its durable fibers or a Cloudflare
Workflow. See Cloudflare's current [Agents webhook
guide](https://developers.cloudflare.com/agents/communication-channels/webhooks/)
and [queue-task reference](https://developers.cloudflare.com/agents/runtime/execution/queue-tasks/).

Use the [automation recipes](../recipes/) to add a bounded action.

Discover exact payloads from the instance's OpenAPI webhook examples, **Admin
→ Webhooks → Event explorer**, or `yarn microfeed webhook sample <event>
--json`. Do not infer fields from prose or accept arbitrary sample payloads as a
replacement for schema validation.

The generated OpenAPI webhook operation also publishes complete JavaScript and
Python `x-codeSamples`. Those samples and `webhook scaffold` are generated from
the same canonical receiver templates. Manual HMAC construction is protocol
reference only; application receivers should use the maintained library.
