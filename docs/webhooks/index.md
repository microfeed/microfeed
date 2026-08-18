---
title: Webhooks and integrations
description: Enable signed webhooks, connect an endpoint, test exact events, and stop delivery safely.
---

Webhooks let an application react when content changes in microfeed. Each
delivery contains a versioned event and is signed with the endpoint's unique
Standard Webhooks secret. A webhook announces a change; it does not grant
permission to read or update content. Integrations that call microfeed's API
need a separate, named Bearer credential with only the permissions they use.

Use **Admin → Webhooks → Event explorer** to inspect the exact payload, headers,
and schema for every supported event. The generated OpenAPI document on the
microfeed instance is the source of truth for those event shapes.

Use microfeed.org's [interactive API
documentation](https://www.microfeed.org/api/v1/) to explore the webhook
operation, exact event schemas, named payload examples, and Standard Webhooks
headers alongside the REST API that an integration can call after receiving an
event.

## Ask a coding agent to read the webhook contract

The public demo's [self-contained `llms-full.txt`
reference](https://www.microfeed.org/api/v1/llms-full.txt) includes the complete
generated webhook contract. Give a coding agent this prompt before it writes a
receiver:

```text
Read https://www.microfeed.org/api/v1/llms-full.txt before writing code. Find
the microfeed webhook operation, event union, Standard Webhooks headers, and
named payload examples. Use them as the source of truth.

I want to build <describe the webhook endpoint or automation>. First identify
the events it should subscribe to and the exact fields it needs. Then implement
a receiver that verifies the signature against the exact raw request bytes
before parsing, rejects invalid signatures, prevents test: true events from
causing production effects, deduplicates deliveries, durably accepts work, and
returns a successful response before slow processing. Do not guess payload
fields, expose secrets, or add production side effects until the signed test
path works.
```

For an endpoint targeting a particular self-hosted site, replace the public URL
in the prompt with `<site-url>/api/v1/llms-full.txt`. That instance file matches
its installed microfeed version and event catalog exactly.

## Enable webhooks

### Local development

Plain `yarn dev` automatically starts Wrangler's isolated Queue simulation,
consumer, maintenance trigger, and local signing-secret encryption. It creates
no Cloudflare resources, requests no Cloudflare permissions, and incurs no
Cloudflare Queue or Worker charges. `yarn dev --enable-webhooks` is accepted as
an explicit alias, but the flag is not required and does not change preview or
production. To omit Queue and Cron simulation for one run, use:

```console
# Replace <instance-name> with a saved instance name.
yarn dev --disable-webhooks --instance <instance-name>
```

This local-only flag does not change the next local run or either deployed
environment.

### Preview or production

Deployed webhooks are opt-in because they create a Queue, producer and consumer
bindings, a Cron trigger, and an endpoint-secret encryption key. Enable them
from a trusted local clone:

```console
# Replace <instance-name> with a saved instance name.
yarn manage deploy --enable-webhooks --instance <instance-name>
```

For an isolated preview environment:

```console
# Replace <instance-name> with a saved instance name.
yarn manage deploy --preview --enable-webhooks --instance <instance-name>
```

### Ask a coding agent to enable webhooks

Run the agent from the trusted repository clone and replace `<instance-name>`
with the saved instance name. Expand only the environment you intend to change.

<details>
<summary>Production coding-agent prompt</summary>

```text
Enable production webhooks for my saved microfeed instance "<instance-name>". Use the
deploy-microfeed skill and the repository's yarn manage CLI. Review the deploy
section of docs/manage-cli.md, confirm the exact instance and production
environment, then run:

yarn manage deploy --enable-webhooks --instance <instance-name>

Do not change preview, another instance, or unrelated Cloudflare resources.
After deployment, run yarn manage status --instance <instance-name> and report whether
the webhook Queue, binding, maintenance trigger, and signing-secret encryption
are ready. Do not ask me for a Cloudflare token or dashboard password.
```

</details>

<details>
<summary>Preview coding-agent prompt</summary>

```text
Enable preview webhooks for my saved microfeed instance "<instance-name>". Use the
deploy-microfeed skill and the repository's yarn manage CLI. Review the deploy
section of docs/manage-cli.md, confirm the exact instance and preview
environment, then run:

yarn manage deploy --preview --enable-webhooks --instance <instance-name>

Do not change production, another instance, or unrelated Cloudflare resources.
After deployment, run yarn manage status --preview --instance <instance-name> and report
whether the preview webhook Queue, binding, maintenance trigger, and
signing-secret encryption are ready. Do not ask me for a Cloudflare token or
dashboard password.
```

</details>

An ordinary deployment preserves the saved lifecycle state: enabled stays
enabled, disabled stays detached, and never-provisioned stays off. It creates
no new Queue or encryption key. Confirm the Queue identity, consumer, binding,
delivery state, and Cron schedule after deployment:

```console
yarn manage status --instance <instance-name>
```

Preview and production use separate Queues. Enabling one does not enable the
other.

## Disable webhooks

To stop one integration, open **Admin → Webhooks → Endpoints** and disable or
delete its endpoint. Disabling cancels pending deliveries and prevents new
delivery reservations. Deleting does the same and frees one of the 20 endpoint
slots.

If every endpoint is disabled or deleted, the hourly handler exits after a
lightweight D1 check. The infrastructure remains enabled, so its Cron trigger
still invokes the Worker.

To stop webhook infrastructure completely while preserving its configuration,
disable the intended deployed environment:

```console
# Replace <instance-name> with a saved instance name.
yarn manage deploy --disable-webhooks --instance <instance-name>
```

For preview:

```console
# Replace <instance-name> with a saved instance name.
yarn manage deploy --preview --disable-webhooks --instance <instance-name>
```

The command pauses the environment's dedicated Queue, cancels pending
deliveries, deploys explicit empty producer, consumer, and Cron configuration,
and purges queued messages. It retains the same Queue and Queue ID, endpoint
settings, encrypted signing secrets, failure streaks, and delivery history.
Events that occur while disabled are not queued or replayed. Retention cleanup
also pauses because the Worker has no webhook Cron trigger.

This follows Cloudflare's documented [Queue pause and purge
controls](https://developers.cloudflare.com/queues/configuration/pause-purge/)
and removes schedules with an explicit empty Cron configuration as required by
the [Cron trigger removal
contract](https://developers.cloudflare.com/workers/configuration/cron-triggers/#remove-a-cron-trigger).

Run the corresponding `--enable-webhooks` command later to reuse that exact
Queue and encryption secret. Repeating either command is safe and verifies the
saved state without creating another Queue. Production and preview remain
independent.

The reviewed `yarn manage destroy` flow removes the retained Queue together
with the environment. Its dry run shows the exact Queue name and ID before any
deletion.

## Create and test an endpoint

For the shortest local path:

1. Scaffold a JavaScript or Python receiver under the ignored `.microfeed/`
   workspace:

   ```console
   yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
     --language javascript
   ```

2. In **Admin → Webhooks → Endpoints**, add
   `http://127.0.0.1:3000/webhook`. Open **Signing secret** and save the unique
   `whsec_…` value as `MICROFEED_WEBHOOK_SECRET`.
3. Install and run the scaffold from its directory:

   ```console
   cd .microfeed/webhooks/endpoint1
   yarn install
   MICROFEED_WEBHOOK_SECRET=whsec_... yarn start
   ```

4. Open **Webhooks → Event explorer**, choose the endpoint and an event, inspect
   its Payload, Schema, and Headers, then send the signed test.

The scaffold verifies the exact raw bytes with the maintained
`standardwebhooks` library and prevents signed `test: true` events from running
production effects. It is a local inspector, not a production queue: replace
its in-memory duplicate tracking and console output with durable acceptance
before deploying real actions.

Use `yarn microfeed webhook listen` when you want a verified inspector or
forwarder without creating a receiver project. For a deployed instance, add
`--tunnel`: the CLI prints a temporary public HTTPS endpoint, offers to
download and verify an app-scoped `cloudflared` helper when needed, and stops
the Quick Tunnel together with the listener. Register the printed URL, paste
the signing secret into the visible prompt, and send the Event
Explorer test. Use `yarn microfeed webhook sample <event> --json` to read an
unsigned exact example from the instance's OpenAPI contract. Event Explorer
sends are real signed deliveries that use the normal Queue, retry policy,
delivery history, and daily budget.

```console
yarn microfeed webhook listen --tunnel
```

Quick Tunnels are temporary development tools, not production endpoints. The
random URL changes on every run and is publicly reachable while the command is
active; Standard Webhooks signature verification remains required.

## Authentication and limits

The endpoint's generated `whsec_…` signing secret authenticates microfeed and
detects request tampering. Keep it only in `MICROFEED_WEBHOOK_SECRET`; never put
it in source code, content, logs, or the endpoint URL. No additional passcode,
Bearer token, URL credential, or custom authentication header is needed for
the inbound webhook.

Each instance permits 20 non-deleted endpoints. Disabled and auto-paused
endpoints count until deleted. The owner-controlled UTC daily delivery budget
defaults to 1,000 and can be changed from 0 through 1,000,000 in **Admin →
Webhooks → Overview** without redeploying. Fanout, tests, and manual
redeliveries consume the budget; retries do not reserve another delivery but
can increase Queue and Worker usage.

## Choose your next step

- [Connect microfeed to n8n or Zapier](../automation/#automation-platforms-n8n-and-zapier).
- [Build a webhook endpoint](./endpoints/).
- [Operate and troubleshoot webhooks](./operations/).
- [Explore content automation examples](../automation/#automation-examples).
- [Review API authentication](../api/authentication/).
