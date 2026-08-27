---
title: Operate and troubleshoot webhooks
description: Operate webhook delivery, retries, budgets, Queue metrics, auto-pause recovery, signing-secret rotation, redelivery, and receiver readiness.
---

This guide covers microfeed webhook delivery and the receiver that accepts each
event. It does not cover failures inside a later model, tool, or destination.

microfeed considers a delivery successful when the receiver durably accepts the
job and returns `2xx`. A later model, tool, or destination failure belongs to
the automation. Retrying that work should happen in its own durable queue; do
not intentionally time out the webhook request while a model runs.

For n8n and Zapier, monitor both microfeed delivery history and the platform or
verification gateway. See the [automation-platform
comparison](../automation/#automation-platforms-n8n-and-zapier) for where
acknowledgment, signature verification, and downstream retries belong.

## Delivery states

| Status | Meaning | Operator action |
| --- | --- | --- |
| `pending` / `retrying` | Waiting for the next attempt. | Inspect the schedule and endpoint health. |
| `succeeded` | Receiver returned `2xx`. | Continue automation-side monitoring. |
| `failed` | A terminal response occurred or six attempts were exhausted. | Fix the receiver, then redeliver if still useful. |
| `suppressed_budget` | The all-or-none daily reservation would exceed the configured budget. | Raise the guard if intended, wait for the UTC reset, or reduce fanout. |
| `suppressed_endpoint_paused` | The endpoint was auto-paused. | Repair, test successfully, and explicitly resume. |
| `canceled_endpoint_paused` | Pending work was canceled when the circuit opened. | Choose manual redelivery after recovery. |
| `canceled_endpoint_disabled` | An administrator disabled or deleted the endpoint. | Re-enable only if intentional. |
| `canceled_webhooks_disabled` | The owner disabled webhook infrastructure for this deployed environment. | Re-enable infrastructure, then manually redeliver only events that remain useful. |

Responses are limited to 4 KiB of diagnostics. Secrets, authorization headers,
and complete remote pages are not stored. Redirects are never followed.

## Retry and timeout behavior

microfeed waits up to 10 seconds to connect and receive the response. It makes
six total attempts: immediately, then at roughly 1 minute, 5 minutes, 30
minutes, 2 hours, and 8 hours. Network errors, timeouts, `408`, `425`, `429`,
and `5xx` retry. Redirects and all other `4xx` responses terminate immediately.

At-least-once Queue delivery means the same delivery ID may arrive more than
once. Deduplicate it in durable storage and make actions idempotent. A manual
redelivery preserves the event ID and exact body while assigning a new delivery
ID, including the original signed `test` value; it therefore needs both
delivery deduplication and action idempotency.

## Budget, cost, and Queue accounting

microfeed reserves the complete fanout atomically against an owner-controlled
UTC daily delivery budget. The default is 1,000; an administrator can change it
immediately from 0 through 1,000,000 under **Webhooks → Overview → Change
budget** without a deployment or restart. This is a fail-closed cost guard, not
a microfeed pricing tier or a Cloudflare quota. Zero stops new reservations,
and lowering the limit below today's usage leaves zero available until the
limit is raised or the next 00:00 UTC reset. Already queued deliveries continue.

microfeed never sends a partial fanout. Tests and manual redeliveries use the
same configured budget. Event Explorer endpoint sends are tests and use that
budget; Explorer previews, copy actions, and loopback terminal prints are free
and do not create delivery records. Retries do not reserve another delivery,
but each attempt can increase Queue operations and Worker execution. The Admin
overview shows used, available, and projected operation counts before a budget
change. `npx @microfeed/cli manage status` verifies the Queue and reports its realtime
backlog and oldest message; Cloudflare-observed writes, reads, deletes, total
billable operations, and average retries for both the site Queue and the
account-wide UTC-day window; microfeed-side delivery accounting; and the
observation time. Analytics is operational telemetry, not a billing invoice.

A normal successful delivery generally uses three Queue operations: write,
read, and delete. Six failed attempts use at most eight under this design: one
write, six reads, and a final delete. Worker execution is metered separately.
As of August 2026, Cloudflare includes 10,000 Queue operations
per day on Workers Free. Workers Paid includes 1,000,000 operations per month,
then charges $0.40 per million operations. These allowances and charges are
account-wide, not per microfeed site, and messages are metered in 64 KB chunks.
Pricing can change: verify the current [Cloudflare Queues
pricing](https://developers.cloudflare.com/queues/platform/pricing/) and the
account-wide Queues dashboard before enabling production alerts.

## Auto-pause, rotation, and redelivery

A successful delivery resets an endpoint's consecutive terminal-failure
streak. At exactly 10 terminal failures, microfeed pauses it, cancels pending
deliveries, and suppresses new matches. Test deliveries are still allowed. A
successful paused test only unlocks the **Resume** control; it does not resume
automatically.

Rotate endpoint secrets from **Admin → Webhooks → Endpoints → Signing
secret**. Reveal the new value, deploy it to the receiver, and keep the
transition bounded. The prior value is retained encrypted for 24 hours. Remove
old secret material from the receiver and secret manager after the transition.

Use manual redelivery only after checking whether the event remains relevant.
It consumes daily budget and can repeat an action unless the automation uses
`event.id + action` idempotency.

## Monitor delivery

Correlate logs by delivery ID, event ID, correlation ID, causation ID, action
idempotency key, and destination operation ID. Never log signing secrets, API
keys, raw authorization headers, or unnecessary private content.

Use **Admin → Webhooks → Deliveries** for event payloads, attempt history,
response diagnostics, and suppression reasons. Use `npx @microfeed/cli manage status` for
Queue bindings, backlog, oldest-message age, and account-wide operation
telemetry. The Cloudflare Queues dashboard is the final place to inspect Queue
health and billing-related usage.

The deployment contract owns reconciliation, retention, and Worker binding
details. See the [management CLI deploy reference](/manage-cli/#yarn-manage-deploy)
when diagnosing provisioning or maintenance behavior instead of depending on
those implementation details in a receiver.

## Safe shutdown

For one integration:

1. Disable the endpoint so no new work is queued.
2. Let the automation's durable queue drain or cancel jobs according to policy.
3. Resolve or export audit records and pending approvals.
4. Delete the endpoint to free its slot.
5. Revoke its API credential and destination permissions.
6. Remove secrets from the runtime and secret manager.

To stop the microfeed environment's webhook Worker invocations as well, run
the appropriate infrastructure command after reviewing its target:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli manage deploy --disable-webhooks --instance <instance-name>
```

Add `--preview` before `--disable-webhooks` for preview. The command cancels
pending microfeed deliveries and purges the Queue rather than draining it. It
removes the producer, consumer, and Cron while retaining the Queue, endpoint
configuration, encrypted signing secrets, and history. Re-enable with the
matching `--enable-webhooks` command; events from the disabled interval are not
replayed.

## Production readiness checklist

- [ ] Raw-body Standard Webhooks verification happens before JSON parsing.
- [ ] The signed body `test` flag gates production side effects; the unsigned
      header hint never overrides it.
- [ ] Delivery IDs and action keys are durably deduplicated in one transaction.
- [ ] The receiver returns `202` only after durable acceptance.
- [ ] Model and external-service work runs in a durable queue or workflow.
- [ ] Current microfeed state is fetched before consequential actions.
- [ ] Correlation and causation headers prevent feedback loops.
- [ ] Content cannot select tools, credentials, destinations, or approval rules.
- [ ] Publication, deletion, payments, and external messages have explicit approval boundaries.
- [ ] Credentials are least-privilege, isolated by integration, and never logged.
- [ ] Audit logs connect event, decision, approval, API change, and destination result.
- [ ] Automation-side rate limits, retry ceilings, dead-letter handling, and cost alerts are configured.
- [ ] Queue backlog, oldest message, webhook budget, failure streaks, and auto-pauses are monitored.
- [ ] Secret rotation and safe-shutdown drills have been tested.
