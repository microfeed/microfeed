---
title: Set up and test an automation
description: Enable Queue-backed webhooks, create an endpoint, run the local listener, and verify a real content event.
---

## 1. Enable the API and webhooks

In **Admin → API → API Settings**, enable API access and public API docs. Create
a separately named integration credential for this automation. Give it only the
read or write permissions the workflow requires; do not reuse a human or
unrelated service credential.

Preview and production webhooks require an explicit deployment opt-in:

```console
yarn manage deploy --enable-webhooks --instance <name>
```

For an isolated preview:

```console
yarn manage deploy --preview --enable-webhooks --instance <name>
```

An ordinary deployment does not request Queue permission or create a Queue.
Production and preview use distinct Queues. Webhook enablement is preserved by
later deployments once selected. The deployed Worker runs an hourly
reconciliation trigger and daily retention cleanup only while at least one
non-deleted endpoint is configured.

Plain `yarn dev` always starts Wrangler's isolated local Queue simulation,
consumer, hourly maintenance trigger, and local secret encryption. It creates
no Cloudflare resource, requests no Cloudflare permission, and incurs no
Cloudflare Queue or Worker charge. `yarn dev --enable-webhooks` is accepted as
an explicit alias, but the flag is not needed locally and does not change
preview or production.

### Run the deployment manually

Use the production or preview command above from a trusted local clone. The
`--enable-webhooks` flag is the explicit consent to create the environment's
Queue, Worker producer and consumer bindings, Cron trigger, and endpoint-secret
encryption key. After deployment, verify the saved site:

```console
yarn manage status --instance <name>
```

### Ask a coding agent to enable webhooks

Give a local coding agent the exact site and environment. For production, this
prompt is copyable as written after replacing `<name>`:

```text
Enable production webhooks for my saved microfeed site "<name>". Follow the
deploy-microfeed skill, review the deploy section of docs/manage-cli.md, and
run yarn manage deploy --enable-webhooks --instance <name>. Do not change
another site or the preview environment. After deployment, run yarn manage
status --instance <name> and report whether the webhook Queue and binding are
ready.
```

For preview, say “preview webhooks,” add `--preview` to both the deployment
instruction and the exact command, and tell the agent not to change production.
The agent must still inspect the checkout, obtain any required Cloudflare
authorization, and follow the deployment skill's approval boundaries.

### Stop webhook delivery

Open **Admin → Webhooks → Endpoints** and disable or delete every endpoint.
Disabling cancels pending deliveries and prevents new reservations; deleting
also frees the endpoint slot. This is immediate and needs no deployment. The
Queue and encryption key remain provisioned for later reuse, but the hourly
trigger exits after one D1 existence check while there are no configured
endpoints, without reconciliation, cleanup, or Queue operations. v1 has no
standalone `--disable-webhooks` deployment option; an owned Queue is removed
only with the complete instance through the reviewed `yarn manage destroy`
flow. Retained webhook history is not pruned while no endpoint is configured;
maintenance resumes if an endpoint is added later.

## 2. Scaffold, register, and run a local receiver

Create a complete JavaScript receiver project offline:

```console
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language javascript
```

The generated server will provide the local endpoint
`http://127.0.0.1:3000/webhook` after you start it. Before starting it, open
**Admin → Webhooks → Endpoints → Add endpoint**, create that URL, and copy the
`whsec_…` value from **Signing secret**. This value is your
`MICROFEED_WEBHOOK_SECRET`; you can reveal or rotate it later from the same
endpoint.

Now install dependencies and run the receiver with the saved secret:

```console
cd .microfeed/webhooks/endpoint1
yarn install
MICROFEED_WEBHOOK_SECRET=whsec_... yarn start
```

The microfeed clone ignores `.microfeed/`, so this local receiver and its
secret files are not checked into the microfeed repository. Use
`.microfeed/webhooks/<endpoint-name>/` for additional endpoints. Move a
production-hardened receiver into its own repository when you are ready to
deploy it. When invoked through the root `yarn microfeed` script, the CLI
resolves this relative directory from the Yarn project root, so it creates
`<microfeed-root>/.microfeed/webhooks/endpoint1`, not
`<microfeed-root>/packages/cli/.microfeed/webhooks/endpoint1`.

Use `--language python` for the Flask starter. Both starters bind only
`127.0.0.1:3000/webhook`, read exact raw bytes, verify signatures with the
maintained `standardwebhooks` library, mark in-memory duplicates, and prevent
`test: true` events from producing production effects. They are local
inspectors, not production queues; duplicate state resets on restart.

Every endpoint receives one unique `whsec_…` Standard Webhooks signing secret.
Store it only as
`MICROFEED_WEBHOOK_SECRET`; never put it in source code or the endpoint URL. The
signature authenticates microfeed and detects tampering, so no separate
passcode, bearer token, URL credential, or custom authentication header is
needed.

Alternatively, use the built-in verified inspector and forwarder:

```console
yarn microfeed webhook listen
```

The listener binds only `127.0.0.1:8978/webhook`. Paste the endpoint signing
secret into its hidden prompt, use `MICROFEED_WEBHOOK_SECRET`, or pass
`--secret-file`; there is deliberately no plaintext `--secret` option.

To test a receiver already listening on another loopback port:

```console
yarn microfeed webhook listen \
  --secret-file .webhook-secret \
  --forward-to http://127.0.0.1:3000/hooks/microfeed
```

The listener verifies the exact request bytes, prints the event, then forwards
the same bytes and webhook headers. Without a forward target it returns `204`.
Use `--json` for one NDJSON record per delivery.

## 3. Discover and test an exact event

If you chose the scaffolded receiver above, its endpoint and secret are already
configured. For `webhook listen`, open **Admin → Webhooks → Endpoints** and
create `http://127.0.0.1:8978/webhook`. Choose one or more events and
open **Signing secret** to reveal the value for the listener. You can return to
reveal it again or rotate it later.

Select **Test** to open **Webhooks → Event explorer** with that endpoint and
`webhook.test` selected. Before sending, inspect its exact Payload, Schema, and
Headers. You can select any of the 22 events, start from its generated OpenAPI
example, or copy a current item, Page, Site File, or theme snapshot. Current
content is never mutated; the copy is adjusted only enough to represent the
simulated event.

Choose **Send test delivery**, confirm the destination and budget impact, then
watch the listener. The delivery uses the selected real event type with signed
`test: true` in its body and `x-microfeed-test: true`. It uses the normal Queue,
signature, retries, history, failure streak, and daily budget, even when the
endpoint is not subscribed to that event. A receiver must verify the signature
before trusting `test`, and a test must not produce production side effects.

On a loopback-hosted Admin session, **Print in yarn dev** writes the exact
preview body to the site terminal under an identifying banner. It stores
nothing, sends no HTTP request, uses no Queue operation or daily budget, and
never prints a secret or signature. It works even when webhook Queue support is
off. Previews and copy actions have the same side-effect-free behavior.

To inspect an exact example without Admin, enable published API docs and run:

```console
yarn microfeed webhook sample item.published --instance <name> --json
```

The CLI reads the named example from that instance's generated OpenAPI
contract; it does not bundle a second event schema. Next, create or publish
real content covered by the endpoint subscription and inspect that delivery's
payload, correlation chain, response status, and attempts.

## Limits and recovery

- At most 20 non-deleted endpoints may exist. Disabled and auto-paused
  endpoints count; deletion frees a slot.
- The owner-controlled daily delivery budget defaults to 1,000 and can be
  changed from 0 through 1,000,000 in **Webhooks → Overview** without a
  deployment. It is a cost guard, not a microfeed pricing tier. If a complete
  fanout does not fit, every matching delivery is recorded as
  `suppressed_budget`.
- Setting the budget to zero stops new reservations. Lowering it below today's
  existing usage leaves zero available until it is raised or 00:00 UTC; already
  queued deliveries continue.
- Each Event Explorer send reserves one delivery and may retry. Explorer previews,
  copy actions, and local terminal prints do not consume delivery budget.
- Retries do not reserve additional deliveries, but they do increase Queue and
  Worker usage.
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
