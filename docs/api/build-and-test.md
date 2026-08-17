---
title: Build an API integration
description: Create a least-privilege credential, inspect the instance contract, test requests, and handle writes, pagination, uploads, and errors safely.
---

Build against the generated contract from the exact microfeed instance your
integration will call. Use a separate named credential for this integration so
the owner can rotate or revoke it without interrupting another client.

For a terminal or local coding agent, use the [microfeed CLI
workflow](/automation/cli/) instead of copying a raw API key. For an
event-driven workflow, start with the [Content automation
overview](/automation/).

## 1. Create a least-privilege key

Enable API access under **Admin → API → API Settings**, then create a named key
under **API Authentication**. Grant read permission for integrations that only
index, export, or inspect content. Add write permission only when the
integration must create, update, or delete content.

Store the resulting `mf_…` value in the integration's secret manager as
`MICROFEED_API_KEY`. Send it only as a Bearer header:

```http
Authorization: Bearer YOUR_API_KEY
```

## 2. Inspect the instance contract

When **Publish API docs** is enabled, the instance exposes:

- `/api/v1/` for the interactive Scalar reference;
- `/api/v1/openapi.json` and `/api/v1/openapi.yaml` for tools and generated
  clients; and
- `/api/v1/llms.txt` and `/api/v1/llms-full.txt` for coding agents.

Use those files for the current paths, fields, validation rules, permissions,
and responses. Do not copy a request shape from another microfeed version or
scrape the Admin dashboard.

## 3. Test in API Explorer

Open **Admin → API → API Explorer**, choose the integration key, and select an
operation. The explorer keeps the selected key in memory and does not store it.
Requests remain disabled until API access is on and a key is selected.

Begin with a read-only feed request. Confirm the response matches the schema in
the same explorer before adding a write.

## 4. Make a read request

Replace the example origin with the root URL of the microfeed site:

```js
const response = await fetch("https://feed.example.com/api/v1/feed/?limit=3", {
  headers: {
    Authorization: `Bearer ${process.env.MICROFEED_API_KEY}`,
  },
});

if (!response.ok) throw new Error(`microfeed returned ${response.status}`);
const feed = await response.json();
```

Keep the key in process configuration rather than source code, logs, URLs, or
request bodies.

## 5. Make an idempotent write

Validate an item payload before creating it when the current contract exposes
the validation operation. For the real create, generate one stable key for the
logical item and reuse the same key and payload after a timeout or transport
failure:

```js
const response = await fetch("https://feed.example.com/api/v1/items/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.MICROFEED_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": logicalItemId,
  },
  body: JSON.stringify(item),
});
```

Do not generate a new idempotency key for each retry. If a webhook started the
action, also send `Microfeed-Correlation-Id` with the original correlation ID
and `Microfeed-Causation-Id` with the triggering event ID. Use idempotency only
where the generated operation documents it.

## 6. Handle pagination, uploads, and errors

Feed and search responses can include `next_url` and `prev_url`. Follow those
exact same-origin URLs instead of constructing or decoding cursors yourself.

Media upload is a three-step flow:

1. Call `POST /api/v1/media_files/presigned_urls/` with the metadata required by
   the current schema.
2. `PUT` the raw bytes to the returned short-lived, same-origin
   `presigned_url` without a Bearer credential.
3. Save the permanent `media_url` in the documented item, channel, Page, or
   rich-content field.

An item `image` is cover art or a thumbnail. `attachments[0]` is its one main
audio, video, document, image, or external attachment and becomes the RSS
enclosure. Do not log or persist the prepared upload URL.

Handle documented responses explicitly:

- `400` for invalid input;
- `401` for a missing or invalid key;
- `403` for insufficient permission;
- `404` for a missing resource or disabled API;
- `409` for an idempotency conflict; and
- `503` when an optional service such as media storage is unavailable.

Treat unknown response fields as forward-compatible additions. Retry only when
the method, idempotency behavior, and documented response make the action safe.

For visual event-driven workflows, continue with the [n8n and Zapier
comparison](/automation/#automation-platforms-n8n-and-zapier). For a custom
receiver, use [Build webhook endpoints](/webhooks/endpoints/).
