---
title: Automation recipes
description: Five webhook-driven patterns for announcements, review, transcription, translation, and search synchronization.
---

These recipes share the receiver from [Build webhook-driven AI
agents](../ai-agents/): verify raw bytes, validate the event, insert the delivery
ID and job atomically, then return `202`. Run model and tool work only from the
durable job consumer.

Begin with `yarn microfeed webhook scaffold
.microfeed/webhooks/endpoint1 --language javascript` (or change the language to
`python`) to prove local signature verification and test gating. The
`.microfeed/` workspace is ignored by the microfeed clone.
Then replace that starter's console-only, in-memory behavior with the durable
receiver described above before adding any recipe effect.

The shared consumer must stop test events before dispatching a recipe:

```ts
async function dispatch(event: MicrofeedEvent) {
  if (event.test) return testAudit.recordAccepted(event); // no production effects
  return handlers[event.type]?.(event);
}
```

Use `yarn microfeed webhook sample <event> --json` or Admin Event Explorer to
inspect the exact input while building each recipe. Event Explorer sends count
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

For local deterministic tests, set `AUTOMATION_MODE=mock`; model, transcription,
translation, and notification adapters should return fixtures without network
access. Send the signed Event Explorer test directly to a scaffolded receiver
at `http://127.0.0.1:3000/webhook`, or inspect and forward it with:

```console
yarn microfeed webhook listen --secret-file .webhook-secret \
  --forward-to http://127.0.0.1:3000/webhook
```

## Publish announcement

**Goal:** `item.published` → generate a short summary → send it to a configured
Slack webhook or generic notification destination. This recipe reads microfeed
and sends externally; it does **not** write back to microfeed.

| Requirement | Configuration |
| --- | --- |
| Prerequisites | Durable job store, summary model or mock, fixed notification adapter and destination. |
| Subscribed events | `item.published` |
| API permissions | Read item, so the worker can fetch current state before announcing. |
| Environment | Shared variables plus `NOTIFICATION_DESTINATION_ID`; keep the actual URL in the adapter's secret store. |
| Data flow | Event → fetch current item → policy check → summarize → send approved destination. |
| Idempotency | `event.id + ":announce"`; store the destination message ID. |
| Loop prevention | Ignore none: this recipe does not write microfeed. Never use a destination supplied by item content. |
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

## Editorial review

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

## Audio transcription

**Goal:** a published item with an audio attachment → transcribe it → append
approved accessible text through the API. This recipe **writes back to
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

## Translate a Page

**Goal:** `page.published` → create or update an unpublished translated Page →
require review before publication. This recipe **writes back to microfeed**.

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

## Knowledge and search synchronization

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

Before production, use the [operations checklist](../operations/).
