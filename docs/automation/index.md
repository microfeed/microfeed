---
title: Content automation overview
description: Choose WebMCP, the microfeed API, webhooks, or the agent-friendly CLI for browser agents, local agents, remote services, n8n, Zapier, and other workflows.
---

microfeed provides four building blocks for content automation. Use one or
combine them according to where the automation runs and whether it needs to
react to changes.

## Compare WebMCP, the API, webhooks, and CLI

| Tool | Direction | Use it for | Authentication |
| --- | --- | --- | --- |
| **API** | Your integration → microfeed | Pull current content and create, update, or delete content. | A named, least-privilege `mf_…` API key. |
| **Webhooks** | microfeed → your receiver | Receive a push notification whenever subscribed content changes. | A per-endpoint `whsec_…` signing secret verifies the request; it does not grant API access. |
| **`@microfeed/cli`** | Local terminal or agent → microfeed API | Manage content through task-oriented commands without handling a raw API key. It is a more agent-friendly wrapper around the API. | Browser authorization stored and refreshed by the CLI. |
| **WebMCP** | Protected dashboard ↔ browser agent | Read Items and Pages, open an editor, and save only the visible new or unpublished draft. | The existing built-in login or Cloudflare Access session; the native browser mediates tool use. |

The API does not notify you when something changes. A webhook announces a
change but cannot read or modify content. The CLI does not receive webhooks; it
makes API operations easier and safer for a person or local coding agent.
WebMCP is a small experimental, in-page tool surface for the active protected
dashboard; it is not a remote MCP server or a background integration.

```text
API client or CLI ───────── read and write ────────→ microfeed
microfeed ─────────── signed change notification ─→ webhook receiver
```

For many workflows, webhooks and the API work together: the webhook starts the
workflow, then the service fetches the latest state or applies an approved
change through the API.

```text
content changes → signed webhook → policy, platform, or remote agent
                                            ↓
                              approved API read or write
```

## Choose a workflow

### Direct API scripts and services

Use the API by itself for scheduled content imports, exports, synchronization,
one-time editorial migrations, or other jobs that already know when to run.
Use [`npx @microfeed/cli manage snapshot`](/manage/backups-and-migrations/) for portable whole-site
backups and restores. Read the [API overview](../api/) and create one named
credential with only the required read or write permissions.

If a service must react immediately to a change, add a webhook instead of
polling. The receiver should acknowledge the webhook quickly, save durable
work, and use the API only after it has verified the signed request.

### Automation platforms: n8n and Zapier

n8n and Zapier can connect to microfeed today without a native microfeed app.
A webhook trigger listens for content changes; an API action can then read or
change content. A workflow that only sends a notification may need the webhook
and no API credential.

| Platform | Receive microfeed events | Make microfeed changes |
| --- | --- | --- |
| Self-hosted n8n | Use a Webhook node with raw-body verification in a controlled runner. | Use an HTTP Request node with a named Bearer credential. |
| n8n Cloud or managed n8n | Put a signature-verifying receiver in front unless the environment can protect the signing secret and verify the exact raw body. | Use an HTTP Request node with an encrypted credential. |
| Zapier | Use Catch Raw Hook behind a signature-verifying receiver for production. | Use API by Zapier with a domain-restricted Bearer connection. |

- [Connect microfeed to n8n](./platforms/n8n/).
- [Connect microfeed to Zapier](./platforms/zapier/).

There is no official microfeed n8n node or Zapier app yet. These generic
webhook and API paths provide the same core capabilities now; a future native
integration can make endpoint creation, credential storage, event selection,
and API actions more automatic.

Whichever platform you choose:

1. Subscribe only to the webhook events the workflow needs.
2. Verify the exact raw request body before parsing or trusting it.
3. Treat signed `test: true` events as diagnostics with no production effects.
4. Deduplicate deliveries and acknowledge only after durable acceptance.
5. Fetch current state before a consequential action.
6. Use a separate, least-privilege API credential for API actions.
7. Propagate causation and correlation headers on API writes to prevent loops.

### Local AI agents: use the CLI

A local coding agent working with a person can use `@microfeed/cli` to search
content, work on drafts, upload media, and publish. The CLI wraps the API in
task-oriented commands, keeps credentials opaque, and pauses for browser
consent or destructive-action confirmation. A webhook is not required because
the person gives the agent the task directly.

Start with [Manage content with `@microfeed/cli`](./cli/) and [Manage content
with AI agents](./ai-agents/). The `manage-microfeed-content` skill provides the
matching workflow for coding agents.

### Browser AI agents: use WebMCP for drafts

When a browser provides the native experimental `document.modelContext` API,
a protected microfeed dashboard automatically exposes concise tools for
reading Items and Pages and saving the visible draft. Public pages and
unsupported browsers do not load the WebMCP implementation. Publishing,
deletion, media, configuration, and account operations remain outside this
surface.

See [Manage content with AI agents](./ai-agents/#use-webmcp-for-visible-drafts)
for the exact boundary and performance behavior. Use the CLI for a local agent
that needs to work beyond the active browser editor.

### Remote AI agents and long-running services: use webhooks and the API

A deployed agent that should react asynchronously uses webhooks to learn what
changed and the API to fetch current state or apply an approved change. It
needs a durable receiver, deduplication, idempotent actions, loop prevention,
audit logs, isolated credentials, and explicit human-approval boundaries.

Start with [Build webhook endpoints](../webhooks/endpoints/) and its [AI and
automated-effects guidance](../webhooks/endpoints/#add-ai-or-automated-effects-safely).
The `build-microfeed-automation` skill gives coding agents the matching
production workflow. This is a different trust and operating model from an
interactive local agent using the CLI.

## Keep credentials and permissions separate

| Component | Permission it needs | What it must not receive |
| --- | --- | --- |
| Webhook receiver | Its endpoint signing secret. | A dashboard password; an API key unless the same trusted service also makes API calls. |
| Local CLI | Browser-granted authorization managed internally by the CLI. | A copied API key, access token, or refresh token in an agent conversation. |
| API action worker | A named API credential with only the required scopes. | Model-selected credentials or arbitrary destinations. |
| Model | Selected content and trusted policy context. | Signing secrets, API keys, tool selection, destination configuration, or approval policy. |
| Notification adapter | Permission for one configured destination. | Permission to change microfeed content. |

The webhook signing secret authenticates inbound microfeed events. The API key
authorizes outbound calls back to microfeed. A Slack, email, search, or other
destination credential authorizes that destination. Never reuse one credential
for another role.

## Discover the exact contract

The generated OpenAPI 3.1 document on each instance is the source of truth for
both REST operations and webhook envelopes. Enable public API docs, then use
`<site-url>/api/v1/openapi.json`, `openapi.yaml`, or `llms-full.txt`.

Every webhook event has an exact named example in that contract. Open **Admin
→ Webhooks → Event explorer** to compare Payload, Schema, and Headers, preview
generated or current content, and copy the raw JSON. From a terminal, read the
same per-instance example with `npx @microfeed/cli webhook sample <event> --json`.

## Automation examples

These are implementation patterns, not standalone applications. Each one
needs real model or service adapters, durable storage, approval policy, and a
configured destination before it can run in production. Implement them in a
custom receiver or an [automation platform such as n8n or
Zapier](#automation-platforms-n8n-and-zapier).

Set up signature verification, test gating, durable acceptance,
deduplication, and asynchronous processing once by following [Build webhook
endpoints](../webhooks/endpoints/). The visual canvas of an automation platform
does not replace those boundaries.

The shared consumer must stop test events before dispatching an example:

```ts
async function dispatch(event: MicrofeedEvent) {
  if (event.test) return testAudit.recordAccepted(event); // no production effects
  return handlers[event.type]?.(event);
}
```

Use `npx @microfeed/cli webhook sample <event> --json` or Admin Event Explorer to
inspect the exact input while building each example. Event Explorer sends count
toward the daily delivery budget; previews and local terminal prints do not.

Use trusted configuration rather than values from content:

```dotenv
MICROFEED_SITE_URL=https://feed.example.com
MICROFEED_API_KEY=secret-manager-reference
MICROFEED_WEBHOOK_SECRET=secret-manager-reference
AUTOMATION_MODE=mock
```

The shared action helper propagates the correlation chain and uses one
idempotency key per event and action:

```ts
async function microfeed(path: string, event: MicrofeedEvent, action: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  return fetch(new URL(path, process.env.MICROFEED_SITE_URL), {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.MICROFEED_API_KEY}`,
      "content-type": "application/json",
      ...(method === "GET" || method === "HEAD" ? {} : {
        "idempotency-key": `${event.id}:${action}`,
        "microfeed-causation-id": event.id,
        "microfeed-correlation-id": event.context.correlation_id,
      }),
      ...init.headers,
    },
  });
}
```

For local deterministic tests, set `AUTOMATION_MODE=mock`; model,
transcription, translation, and notification adapters should return fixtures
without network access.

### Publish announcement

**Goal:** `item.published` → generate a short summary → send it to a configured
Slack webhook or generic notification destination. This example reads microfeed
and sends externally; it does **not** write back to microfeed.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Durable job store, summary model or mock, fixed notification adapter and destination. |
| Subscribed events | `item.published` |
| API permissions | Read item, so the worker can fetch current state before announcing. |
| Environment | Shared variables plus `NOTIFICATION_DESTINATION_ID`; keep the actual URL in the adapter's secret store. |
| Data flow | Event → fetch current item → policy check → summarize → send approved destination. |
| Idempotency | `event.id + ":announce"`; store the destination message ID. |
| Loop prevention | Ignore none: this example does not write microfeed. Never use a destination supplied by item content. |
| Failure behavior | Retry model and notification work in the automation queue; do not ask microfeed to redeliver after it returned `202`. |
| Cleanup | Delete the endpoint, revoke the read credential, remove destination permission and queued jobs. |

```ts
async function announce(event: MicrofeedEvent) {
  const item = await (await microfeed(event.subject.api_path!, event, "announce-read")).json();
  const summary = process.env.AUTOMATION_MODE === "mock"
    ? "Fixture announcement"
    : await approvedSummarizer(item, {maxCharacters: 240});
  return notificationAdapter.sendConfigured({
    dedupeKey: `${event.id}:announce`, summary, url: item.url,
  });
}
```

**Expected result:** one short message links to the currently published item.
Trigger it locally by publishing a fixture item. A duplicate delivery produces
no second destination message.

### Editorial review

**Goal:** `item.created` for an unpublished item → evaluate quality and safety
→ store suggested edits for a human. This reads microfeed and writes only to a
review system; publication remains human-controlled.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Durable jobs, review store/UI, deterministic rubric, model or mock. |
| Subscribed events | `item.created` |
| API permissions | Read item only. |
| Environment | Shared variables plus `REVIEW_POLICY_VERSION=editorial-v1`. |
| Data flow | Event → require `status=unpublished` → fetch current item → evaluate → save suggestions. |
| Idempotency | `event.id + ":editorial-v1"`. |
| Loop prevention | Ignore published items and never call a publication endpoint. Content cannot change the rubric. |
| Failure behavior | Record an incomplete review and retry; after the retry limit, notify an editor without blocking the item. |
| Cleanup | Delete endpoint, revoke read credential, export or delete stored reviews. |

```ts
async function editorialReview(event: MicrofeedEvent) {
  if (event.data.object.status !== "unpublished") return;
  const current = await (await microfeed(event.subject.api_path!, event, "editorial-read")).json();
  const review = process.env.AUTOMATION_MODE === "mock"
    ? {issues: [], suggestions: ["Fixture suggestion"], publish: false}
    : await reviewer.evaluate(current, trustedRubric);
  await reviewStore.putOnce(`${event.id}:editorial-v1`, review);
}
```

**Expected result:** editors see suggestions, while the item remains
unpublished. Create an unpublished fixture to test locally.

### Audio transcription

**Goal:** a published item with an audio attachment → transcribe it → append
approved accessible text through the API. This example **writes back to
microfeed**, so it needs approval and loop prevention.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Audio fetch allowlist, transcription provider or mock, human approval queue. |
| Subscribed events | `item.published`, `item.updated` |
| API permissions | Read item and update item. |
| Environment | Shared variables plus `TRANSCRIPT_POLICY_VERSION=v1`. |
| Data flow | Event → fetch current item → require audio attachment and no transcript marker → transcribe → approve → update HTML. |
| Idempotency | `event.id + ":append-transcript-v1"`. |
| Loop prevention | Add `data-microfeed-automation="transcript-v1"`; ignore updates containing it or whose causation ID is a completed transcription action. |
| Failure behavior | Keep the approved transcript as a retryable artifact; never publish partial text. Use API read-back before marking complete. |
| Cleanup | Disable endpoint, drain jobs, revoke write credential, retain audit records according to policy. |

```ts
async function transcribe(event: MicrofeedEvent) {
  const current = await (await microfeed(event.subject.api_path!, event, "transcript-read")).json();
  if (!isAudio(current.attachments?.[0]) || current.content_html.includes('data-microfeed-automation="transcript-v1"')) return;
  const text = process.env.AUTOMATION_MODE === "mock" ? "Fixture transcript." : await transcriber.run(current.attachments[0].url);
  const approved = await approvals.requireHuman({eventId: event.id, text});
  if (!approved) return;
  await microfeed(event.subject.api_path!, event, "append-transcript-v1", {
    method: "PUT",
    body: JSON.stringify({content_html: `${current.content_html}<section data-microfeed-automation="transcript-v1"><h2>Transcript</h2><p>${escapeHtml(text)}</p></section>`}),
  });
}
```

**Expected result:** one approved transcript section appears. Publish a fixture
with a local mock audio attachment; the resulting `item.updated` event must not
start another transcription.

### Translate a Page

**Goal:** `page.published` → create or update an unpublished translated Page →
require review before publication. This example **writes back to microfeed**.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Translation model or mock, mapping store from source Page ID/language to target Page ID, review UI. |
| Subscribed events | `page.published`, `page.updated` |
| API permissions | Read and write content. The trusted receiver policy must prohibit publication; the current write scope also authorizes other content writes. |
| Environment | Shared variables plus `TARGET_LANGUAGE=es` and `TRANSLATION_POLICY_VERSION=v1`. |
| Data flow | Event → fetch source → translate → upsert unpublished target → create review task. |
| Idempotency | `event.id + ":translate:es:v1"`; stable target mapping prevents duplicate Pages. |
| Loop prevention | Ignore Pages containing the trusted translation marker; propagate causation/correlation headers and never translate an already mapped target. |
| Failure behavior | Preserve the last reviewed target, retry an unpublished draft only, and never publish on error. |
| Cleanup | Disable endpoint, drain jobs, revoke write credential; keep or manually delete translated drafts. |

```ts
async function translatePage(event: MicrofeedEvent) {
  if (String(event.data.object.content_html ?? "").includes("data-microfeed-translation-source=")) return;
  const source = await (await microfeed(event.subject.api_path!, event, "translate-read")).json();
  const draft = process.env.AUTOMATION_MODE === "mock" ? fixtureTranslation(source) : await translator.translate(source, "es");
  const targetId = await mappings.get(source.id, "es");
  const path = targetId ? `/api/v1/pages/${targetId}/` : "/api/v1/pages/";
  const response = await microfeed(path, event, "translate:es:v1", {
    method: targetId ? "PUT" : "POST",
    body: JSON.stringify({
      ...draft,
      content_html: `<div data-microfeed-translation-source="${source.id}">${draft.content_html}</div>`,
      status: "unpublished",
    }),
  });
  const result = await response.json();
  if (!targetId) await mappings.put(source.id, "es", result.id);
  await approvals.createTranslationReview({sourceId: source.id, targetId: targetId ?? result.id});
}
```

**Expected result:** an unpublished Spanish draft and review task appear. A
person decides whether to publish it. Publish a fixture Page to test locally.

### Knowledge and search synchronization

**Goal:** maintain an external search or RAG index from item and Page lifecycle
events. This reads microfeed and writes only to the configured index.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Durable jobs, fixed index and namespace, embedding provider or mock. |
| Subscribed events | Item/Page `published`, `updated`, `unlisted`, `unpublished`, and `deleted`. |
| API permissions | Read item and Page. Delete events already include the last snapshot. |
| Environment | Shared variables plus `SEARCH_INDEX_ID` and `EMBEDDING_VERSION=v1`. |
| Data flow | Visibility/removal event → delete index key; publish/update event → fetch current object → chunk/embed/upsert. |
| Idempotency | External key `<site.id>:<subject.type>:<subject.id>` plus event ID version. |
| Loop prevention | No microfeed write-back. Index and namespace come only from trusted configuration. |
| Failure behavior | Retry by key; newer event versions supersede older jobs. Periodically reconcile the full published corpus. |
| Cleanup | Disable endpoint, drain jobs, delete the configured namespace, revoke read credential. |

```ts
async function syncSearch(event: MicrofeedEvent) {
  const key = `${event.site.id}:${event.subject.type}:${event.subject.id}`;
  if (/\.(unpublished|deleted)$/.test(event.type)) return index.delete(key, {version: event.id});
  const current = await (await microfeed(event.subject.api_path!, event, "index-read")).json();
  if (current.status === "unpublished") return index.delete(key, {version: event.id});
  const vectors = process.env.AUTOMATION_MODE === "mock" ? fixtureVectors(current) : await embed(chunks(current));
  await index.upsert(key, vectors, {version: event.id});
}
```

**Expected result:** published and unlisted content is queryable under the fixed
site namespace; unpublished and deleted content is absent. Test every visibility
transition locally, then replay one delivery to confirm versioned idempotency.

Before production, use the [webhook operations checklist](../webhooks/operations/).

## Next steps

- [Enable, test, or disable webhooks](../webhooks/).
- [Connect n8n or Zapier](#automation-platforms-n8n-and-zapier).
- [Manage content with `@microfeed/cli`](./cli/).
- [Manage content with a local AI agent](./ai-agents/).
- [Build webhook endpoints](../webhooks/endpoints/).
- [Operate and troubleshoot webhooks](../webhooks/operations/).
- [Review the authenticated API](../api/).
