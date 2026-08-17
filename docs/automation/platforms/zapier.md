---
title: Connect microfeed to Zapier
description: Test microfeed events in a Zapier automation, put verification in the right place, and call the API without exposing credentials.
---

Zapier can receive microfeed events and call the microfeed API today, but the
generic trigger has an important production limitation: it cannot both keep a
microfeed signing secret in a supported secret store and verify the raw request
before Zapier acknowledges it. Use the direct Catch Raw Hook path to design and
test mappings. Put a verified receiver in front before enabling production
effects.

## What works today

[Webhooks by Zapier](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zap-workflows-from-webhooks)
provides a **Catch Raw Hook** trigger that keeps the unparsed body and headers.
Its 2 MB raw-body limit is above microfeed's 256 KiB webhook limit. Zapier
acknowledges the hook independently of later Zap steps and can delay downstream
processing during throttling.

As of August 2026, Zapier lists Webhooks by Zapier as a paid-plan feature.
Check its linked availability information before designing a workflow around
it.

[Code by Zapier](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier)
can inspect trigger data, but Zapier explicitly does not support storing an
arbitrary secret in Code. Do not paste `whsec_…` into code, Input Data, a Zap
field, or Zap history. Without that secret, a direct Catch Raw Hook has not
authenticated microfeed even when its payload looks correct.

| Path | Appropriate use |
| --- | --- |
| Direct Catch Raw Hook | Event discovery, field mapping, and no-effect tests only |
| Verified receiver → Catch Hook | Production notifications and actions |
| Future native microfeed Zapier app | Direct signed trigger and named actions without a custom gateway |

## Prototype the event mapping

This path proves that the Zap receives the expected shape. It is not production
authentication.

1. Create a Zap and choose **Webhooks by Zapier → Catch Raw Hook** as the
   trigger.
2. Copy the generated hook URL. Treat it as a password; anyone who obtains it
   can trigger the Zap.
3. In **microfeed Admin → Webhooks → Endpoints**, add that URL and subscribe to
   one event, such as `item.published`.
4. In **Webhooks → Event explorer**, select the endpoint and send a signed
   test.
5. Return to Zapier and load the trigger record. Confirm that the raw body and
   the `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers are
   present.
6. Parse the body only for mapping. Do not connect Slack, email, API, AI, or
   other effect steps to this direct prototype.

The signed body contains `test: true`, but an unverified direct Zap must not
trust even that flag. Event Explorer is the trusted source of the test during
this prototype.

When the mapping is understood, disable the direct microfeed endpoint. Keeping
it enabled consumes delivery budget and leaves an unauthenticated trigger path.

## Build the production verification gateway

The recommended production shape is:

```text
microfeed → Standard Webhooks receiver → durable job → Zapier Catch Hook
```

Build the receiver from the maintained local starter:

```console
yarn microfeed webhook scaffold .microfeed/webhooks/zapier-gateway \
  --language javascript
```

The scaffold uses the maintained `standardwebhooks` library and exact raw
bytes. Before deploying it, add the production requirements from [Build
webhook endpoints](/webhooks/endpoints/):

1. Store the microfeed endpoint secret only as
   `MICROFEED_WEBHOOK_SECRET` in the gateway's secret manager.
2. Verify before parsing and reject invalid signatures.
3. Save the delivery ID, verified event, and downstream job atomically.
4. Return `202` to microfeed after durable acceptance, within 10 seconds.
5. In a background worker, POST a normalized object such as
   `{delivery_id, event}` to the Zapier Catch Hook URL.
6. Keep the Zapier hook URL in a separate gateway secret. Do not forward the
   microfeed signing secret or use it to authenticate Zapier.
7. Retry Zapier failures in the gateway queue and dead-letter exhausted jobs.

The gateway preserves the signed event's `test` value. The Zap must add a
Filter immediately after its trigger and continue only when `event.test` is
exactly `false`. Test jobs may be recorded for diagnostics, but they cannot
invoke production actions.

The gateway consumes one of the microfeed instance's 20 endpoint slots. It can
route verified events to several Zaps without adding another microfeed endpoint
for each Zap, but its own fanout, limits, and cost controls are then your
responsibility.

## Call the microfeed API safely

For actions that read or write microfeed, create a separate named `mf_…` API
key with only the required permission. Use [API by
Zapier](https://help.zapier.com/hc/en-us/articles/44391650357005-Send-API-requests-in-Zap-workflows),
which Zapier lists as a paid feature as of August 2026, so the Bearer key stays
in a reusable app connection rather than a Zap field.

Create the connection with:

```text
Authentication type: Static Headers (API key)
Header: Authorization: Bearer mf_...
Domain filter: <the exact microfeed site hostname>
```

Then add **API by Zapier → API Request** and configure the method, `/api/v1/`
URL, and JSON body from the instance's generated OpenAPI contract. Zapier adds
the Authorization header from the connection. Do not add it again in the
action.

For a write-back request, map these headers from the verified event:

```text
Microfeed-Correlation-Id: <event correlation ID, or event ID>
Microfeed-Causation-Id: <event ID>
Idempotency-Key: <event ID>:<action name>
```

Use `Idempotency-Key` where the OpenAPI operation documents it. Fetch current
state before a consequential change, and keep publication or deletion behind
an explicit approval step.

Do not use an outgoing Webhooks by Zapier step for the microfeed API key. Its
credentials live in the Zap step and its generic authentication options do not
provide the same isolated Bearer connection.

## Test the complete path

1. Point a microfeed endpoint at the deployed verification gateway.
2. Reveal its signing secret and configure the gateway.
3. Send `webhook.test` from Event Explorer.
4. Confirm microfeed records a `2xx`, the gateway records a verified delivery,
   and the Zap stops at the test filter.
5. Trigger one real subscribed mutation.
6. Confirm the Zap runs once and any API action contains the expected
   correlation, causation, and idempotency headers.
7. Replay the downstream job and confirm deduplication or destination
   idempotency prevents a repeated effect.

## Failure and ownership behavior

- Zapier may return `200` before later steps run. Once the gateway accepts the
  job, later Zap failures belong to the gateway/Zapier side, not microfeed.
- Zapier can throttle webhook processing. Monitor Zap history as well as the
  gateway queue, oldest job, retries, and dead letters.
- A turned-off or deleted Zap eventually returns `404`. microfeed treats that
  as terminal; the gateway should pause its Zapier destination and alert.
- Zapier says a Catch Hook URL changes when a Zap transfers to another owner.
  Update the gateway secret and send a test after a transfer.
- A `429` or `5xx` from the gateway is retryable by microfeed. Most other
  `4xx` responses are terminal.
- Content is untrusted input. It cannot select connected apps, recipients,
  credentials, URLs, tools, or approval policy.

Continue with the [automation examples](/automation/#automation-examples)
for bounded actions and
[webhook operations](/webhooks/operations/) for microfeed delivery recovery.
