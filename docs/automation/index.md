---
title: Content automation overview
description: Connect microfeed webhooks, AI agents or services, and authenticated API actions without giving content control to untrusted input.
---

Content automation has three separate roles:

1. A **webhook** announces what changed. It is a signed fact, not an instruction.
2. An **agent or service** applies your policy and decides whether to propose or perform an action.
3. The authenticated **microfeed API** reads current state or applies an approved change with a least-privilege integration credential.

Keeping these roles separate makes retries, human approval, audit trails, and
prompt-injection boundaries much easier to reason about.

```text
microfeed mutation → signed webhook → durable receiver → policy/model/tools
                                                    ↘ approved API change
```

The generated OpenAPI 3.1 document on each instance is the source of truth for
both REST operations and webhook event envelopes. Enable public API docs, then
use `<site-url>/api/v1/openapi.json`, `openapi.yaml`, or `llms-full.txt`. This
guide intentionally does not maintain a second copy of those schemas.

Every supported event has an exact named example in the OpenAPI webhook
operation. For visual discovery, open **Admin → Webhooks → Event explorer** to
compare Payload, Schema, and Headers, preview generated or current content, and
copy the exact raw JSON. From a terminal, read the same per-instance example
with `yarn microfeed webhook sample <event> --json`.

## Choose an automation style

| Style | Best for | Tradeoffs |
| --- | --- | --- |
| Polling | A legacy system that cannot receive HTTP | Delayed, wasteful, and must track cursors. |
| Direct API script | A scheduled import or one-time migration | Simple, but does not react immediately. |
| CLI-driven coding agent | Interactive editorial work with a person present | Browser consent and destructive confirmations remain human-controlled. |
| Webhook service | Deterministic notifications and synchronization | Needs signature verification, durable work, and deduplication. |
| Long-running AI agent | Classification, transformation, and multi-step workflows | Needs strict tool policy, approvals, audit logs, and cost controls. |

An interactive coding agent should use `@microfeed/cli` and the
`manage-microfeed-content` skill. A deployed receiver that continuously reacts
to webhooks should use the `build-microfeed-automation` skill. These are
different trust and operating models.

## Components and permissions

| Component | Receives | Permission it needs | Must not receive |
| --- | --- | --- | --- |
| Webhook receiver | Signed raw event bytes | Endpoint signing secret | Dashboard password or API key unless it also performs API actions. |
| Durable job store | Verified event and action state | Its own storage access | Unencrypted integration credentials in job payloads. |
| Model | Selected content and policy context | No direct microfeed permission | Signing secrets, API keys, destination choice, or approval policy. |
| API action worker | A validated, approved action | Named integration credential with required scopes | Model-selected credentials or arbitrary URLs. |
| Notification adapter | Approved message and configured destination | Destination-specific send permission | Permission to write microfeed content. |

Plain `yarn dev` automatically enables Wrangler's local Queue simulation. It
creates no Cloudflare resources, requests no Cloudflare permissions, and incurs
no Cloudflare Queue or Worker charges. Preview and production remain explicitly
opt-in with `yarn manage deploy --enable-webhooks` because they create deployed
resources and account-wide usage.

Each instance permits 20 non-deleted endpoints. Its owner-controlled daily
delivery budget defaults to 1,000 and can be changed from 0 through 1,000,000 in
**Admin → Webhooks → Overview** without redeploying. This is a cost guard, not a
microfeed pricing tier. Fanout, tests, and manual redeliveries all count toward
the configured UTC-day budget.

## Next steps

- [Set up and test an automation](./setup-and-test/).
- [Build webhook-driven AI agents](./ai-agents/).
- [Start from an automation recipe](./recipes/).
- [Operate and troubleshoot automations](./operations/).
- [Review the authenticated API](../api/).
