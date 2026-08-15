---
title: Build webhook-driven AI agents
description: Verify, deduplicate, durably accept, and safely act on webhook events with TypeScript, Python, or Cloudflare Agents.
---

The receiver's synchronous job is intentionally small:

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

## Framework-neutral TypeScript receiver

This example uses a hypothetical transactional `jobs` adapter. Replace it with
Postgres, D1 plus a Queue, or another durable system. The signature is Standard
Webhooks HMAC-SHA256 over the exact bytes.

```ts
import {createHmac, timingSafeEqual} from "node:crypto";

function verify(raw: Buffer, headers: Headers, secret: string): boolean {
  const id = headers.get("webhook-id") ?? "";
  const timestamp = headers.get("webhook-timestamp") ?? "";
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), raw]))
    .digest();
  return (headers.get("webhook-signature") ?? "").split(" ").some((part) => {
    const [version, encoded] = part.split(",", 2);
    const supplied = version === "v1" && encoded ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export async function receive(request: Request): Promise<Response> {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verify(raw, request.headers, process.env.MICROFEED_WEBHOOK_SECRET!)) {
    return new Response("invalid signature", {status: 401});
  }
  const event = JSON.parse(raw.toString("utf8"));
  await jobs.insertOnceAndEnqueue({
    deliveryId: request.headers.get("webhook-id"),
    event,
    effectPolicy: event.test === true ? "no-production-effects" : "production",
  });
  return new Response(null, {status: 202});
}
```

## Framework-neutral Python receiver

```python
import base64, hashlib, hmac, json, os, time

def receive(request, jobs):
    raw = request.get_data(cache=False)
    delivery_id = request.headers.get("webhook-id", "")
    timestamp = request.headers.get("webhook-timestamp", "")
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > 300:
        return ("invalid timestamp", 401)
    secret = base64.b64decode(os.environ["MICROFEED_WEBHOOK_SECRET"].removeprefix("whsec_"))
    expected = hmac.new(secret, delivery_id.encode() + b"." + timestamp.encode() + b"." + raw, hashlib.sha256).digest()
    supplied = [part.split(",", 1)[1] for part in request.headers.get("webhook-signature", "").split(" ") if part.startswith("v1,")]
    if not any(hmac.compare_digest(base64.b64decode(value), expected) for value in supplied):
        return ("invalid signature", 401)
    event = json.loads(raw)
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
