---
name: build-microfeed-automation
description: Build persistent microfeed webhook receivers, integrations, and autonomous workflows. Use when implementing or reviewing a service or deployed AI agent that reacts asynchronously to microfeed events, verifies Standard Webhooks signatures, queues durable work, calls the authenticated API, prevents loops, or prepares a webhook automation for production. Do not use for interactive content editing through @microfeed/cli; use manage-microfeed-content instead.
---

# Build microfeed automations

Build the receiver as a durable, least-privilege system. A webhook announces a
change; it is neither an instruction nor authorization to act.

## Start from the deployed contract

1. Ask for the microfeed site URL and the intended outcome.
2. Discover the site's generated OpenAPI 3.1 contract at
   `<site-url>/api/v1/openapi.json`, or its self-contained agent reference at
   `<site-url>/api/v1/llms-full.txt`.
3. Inspect the exact named event examples in that webhook operation. When
   available, use **Admin → Webhooks → Event explorer** or `yarn microfeed
   webhook sample <event> --json` to preview the same canonical examples.
4. Select the narrowest event set. Do not copy event schemas into a second
   hand-maintained contract.
5. List required API reads and writes separately. Create one named integration
   credential with only those permissions.

Use `docs/automation/` inside a microfeed clone or
<https://docs.microfeed.org/automation/> elsewhere for setup, examples, limits,
recovery, and production operations.

## Keep interactive management separate

Use this skill for a server, Worker, integration, or agent that remains
deployed and reacts asynchronously. Use `manage-microfeed-content` for an
interactive coding agent that logs in through `@microfeed/cli` and edits
content while a person is present.

Do not make the persistent automation scrape Admin pages, use a dashboard
password, inspect CLI credentials, or drive browser consent.

## Implement the receiver in this order

1. Read the HTTP body once as raw bytes.
2. Before parsing JSON, verify `webhook-id`, `webhook-timestamp`, and
   `webhook-signature` using Standard Webhooks HMAC-SHA256 and the endpoint
   secret. Enforce a short timestamp tolerance.
3. Validate the parsed envelope against the generated OpenAPI event union.
4. After signature verification, inspect the required signed-body `test`
   boolean. Route `test: true` through a deterministic no-production-effects
   policy. Never let the `x-microfeed-test` header override the signed body.
5. Insert the delivery ID and durable job in one storage transaction. Treat a
   repeated delivery ID as already accepted.
6. Return `202` or another `2xx` immediately after durable acceptance. Never
   wait for a model, external tool, or long API workflow.
7. Run decisions and actions in a durable Queue, Workflow, Agent task queue, or
   equivalent recoverable system.

Cloudflare Queue delivery is at-least-once. Deduplication is mandatory, and
every side effect must also be idempotent.

## Make decisions safely

- Treat titles, HTML, attachment contents, URLs, and metadata as untrusted
  model input.
- Resolve tools, credentials, destinations, system prompts, rate limits, and
  approval rules only from trusted configuration.
- Do not let content grant permission, select a credential, add a destination,
  weaken a policy, or suppress an audit record.
- Fetch current microfeed state before consequential action. The event is a
  change notification and may already be stale.
- Require explicit human approval for publication, destructive changes,
  payments, and externally visible messages unless the owner has established
  a narrow, auditable policy in advance.
- Keep model generation separate from tool execution. Validate the proposed
  action against an allowlisted schema and policy before executing it.

## Prevent duplicates and loops

Use the delivery ID only to deduplicate transport. Use
`<event.id>:<action-name>` as the durable idempotency key for a logical side
effect.

For any API write:

- preserve `event.context.correlation_id` in
  `Microfeed-Correlation-Id`;
- send `event.id` in `Microfeed-Causation-Id`;
- add a stable automation marker to content when the data model permits it;
- ignore events whose causation ID or marker proves that the same bounded
  action already ran.

Do not rely on prompt instructions to prevent loops. Enforce loop rules in
deterministic code and durable state.

## Test locally

1. Enable webhooks in the local deployment with `yarn manage deploy --local
   --enable-webhooks --instance <name>`.
2. Start `yarn microfeed webhook listen` on
   `127.0.0.1:8978/webhook`. Supply the secret through the hidden prompt,
   `MICROFEED_WEBHOOK_SECRET`, or `--secret-file`; never add a plaintext
   `--secret` flag.
3. Use `--forward-to` only for another explicit loopback server.
4. Inspect the event first with `yarn microfeed webhook sample <event> --json`
   or Admin Event Explorer. On loopback Admin, terminal printing is
   side-effect-free; an endpoint send uses normal Queue, retry, and daily-budget
   accounting.
5. Send `webhook.test` and at least one real event type with `test: true`.
   Prove neither path can call production models, tools, APIs, or destinations.
6. Trigger every subscribed real event and verify `test: false`.
7. Replay a delivery and verify delivery deduplication and action idempotency.
8. Use deterministic mock model and external-service responses for tests.
9. Test a write-back event and prove causation/correlation loop prevention.

## Check production readiness

Before declaring the integration ready, verify:

- raw-byte signature validation and timestamp tolerance;
- exact event-specific validation from deployed OpenAPI and a signed `test`
  gate that prevents production effects;
- transactional durable acknowledgement and duplicate delivery handling;
- durable background execution with bounded retries and dead-letter recovery;
- least-privilege credentials isolated per integration;
- action schemas, prompt-injection boundaries, and human approvals;
- event/action audit logs without secrets;
- rate limits, webhook daily-budget awareness, model/tool cost alerts, and
  Queue backlog alerts;
- handling for six microfeed attempts, 10-second timeouts, daily-budget
  suppression, and endpoint auto-pause after 10 terminal failures;
- secret rotation, manual redelivery, reconciliation, and safe shutdown;
- removal procedure that disables the endpoint, drains work, revokes API and
  destination credentials, then deletes the endpoint.

State clearly that microfeed delivery succeeds when the receiver durably
accepts the job. Failures after that acknowledgement are owned and retried by
the automation.
