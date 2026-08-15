---
title: Operate and troubleshoot automations
description: Understand delivery states, retries, budgets, Queue metrics, auto-pause recovery, rotation, redelivery, and production readiness.
---

microfeed considers a delivery successful when the receiver durably accepts the
job and returns `2xx`. A later model, tool, or destination failure belongs to
the automation. Retrying that work should happen in its own durable queue; do
not intentionally time out the webhook request while a model runs.

## Delivery states

| Status | Meaning | Operator action |
| --- | --- | --- |
| `pending` / `retrying` | Waiting for the next attempt. | Inspect the schedule and endpoint health. |
| `succeeded` | Receiver returned `2xx`. | Continue automation-side monitoring. |
| `failed` | A terminal response occurred or six attempts were exhausted. | Fix the receiver, then redeliver if still useful. |
| `suppressed_budget` | The all-or-none daily reservation would exceed 1,000. | Wait for the UTC reset or reduce fanout. |
| `suppressed_endpoint_paused` | The endpoint was auto-paused. | Repair, test successfully, and explicitly resume. |
| `canceled_endpoint_paused` | Pending work was canceled when the circuit opened. | Choose manual redelivery after recovery. |
| `canceled_endpoint_disabled` | An administrator disabled or deleted the endpoint. | Re-enable only if intentional. |

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

microfeed reserves the complete fanout atomically against a 1,000-delivery UTC
daily budget. It never sends a partial fanout. Tests and manual redeliveries use
the same budget. Event Explorer endpoint sends are tests and use that budget;
Explorer previews, copy actions, and loopback terminal prints are free and do
not create delivery records. The Admin overview estimates Queue operations from
reserved deliveries. `yarn manage status` verifies the Queue and reports its realtime
backlog and oldest message; Cloudflare-observed writes, reads, deletes, total
billable operations, and average retries for both the site Queue and the
account-wide UTC-day window; microfeed-side delivery accounting; and the
observation time. Analytics is operational telemetry, not a billing invoice.

A normal successful delivery generally uses three Queue operations: write,
read, and delete. Six failed attempts use at most eight under this design: one
write, six reads, and a final delete. Worker execution is metered separately.
As of this documentation update, Cloudflare includes 10,000 Queue operations
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

Rotate endpoint secrets from **Admin → Webhooks → Endpoints**. Copy the new
secret once, deploy it to the receiver, and keep the transition bounded. The
prior value is retained encrypted for 24 hours. Remove old secret material from
the receiver and secret manager after the transition.

Use manual redelivery only after checking whether the event remains relevant.
It consumes daily budget and can repeat an action unless the automation uses
`event.id + action` idempotency.

## Logs and reconciliation

Correlate logs by delivery ID, event ID, correlation ID, causation ID, action
idempotency key, and destination operation ID. Never log signing secrets, API
keys, raw authorization headers, or unnecessary private content.

A five-minute scheduled reconciler enqueues saved deliveries that were not
successfully handed to the Queue. Atomic leases prevent concurrent consumers
from executing the same attempt. Delivery, attempt, suppression, and event
history is retained for 30 days.

## Safe shutdown

1. Disable the endpoint so no new work is queued.
2. Let the automation's durable queue drain or cancel jobs according to policy.
3. Resolve or export audit records and pending approvals.
4. Delete the endpoint to free its slot.
5. Revoke its API credential and destination permissions.
6. Remove secrets from the runtime and secret manager.

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
