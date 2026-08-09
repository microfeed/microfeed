---
title: API overview
description: Use microfeed as a headless CMS with named Bearer API keys and generated OpenAPI documents.
---

microfeed has two structured interfaces with different purposes:

- The public **JSON Feed** at `/json/` lets readers and software consume
  published channel content without a credential.
- The optional authenticated **API** under `/api/v1/` lets integrations read,
  create, update, and delete content, update the primary channel, and prepare
  item images and media-attachment uploads.

New installations keep API access and public API docs off until the instance
owner enables them in the dashboard.

## What the API can do

The generated OpenAPI 3.1 contract currently includes:

| Operation | Purpose |
| --- | --- |
| `GET /api/v1/feed/` | Read the complete feed with cursor pagination. |
| `POST /api/v1/items/` | Create an item. |
| `GET /api/v1/items/{itemId}/` | Read one item. |
| `PUT /api/v1/items/{itemId}/` | Update provided fields without clearing omitted fields. |
| `DELETE /api/v1/items/{itemId}/` | Delete one item. |
| `GET /api/v1/search/` | Search item titles or plain-text content with filters and cursor pagination. |
| `PUT /api/v1/channels/primary/` | Update the primary channel. |
| `POST /api/v1/media_files/presigned_urls/` | Prepare a short-lived, same-origin media upload. |

Each item may have both an `image` for cover art or a thumbnail and one main
media attachment in `attachments[0]`. The attachment may be audio, video, a
document, an image, or an external link; it becomes the RSS `<enclosure>`.

Search uses the site's D1 database. Terms are combined with AND, the last term
supports prefix matching, and single or double quotes select an exact phrase.
Exact matches rank before typo-tolerant title matches. Use the generated API
reference for the current `fields`, status, publication-date, limit, cursor,
highlight, and response schemas.

![The microfeed API Explorer showing parameters, JavaScript fetch code, and the response schema for fetching a feed](/images/screenshots/3-api-1.png)

Every direct integration request requires a full-access `mf_…` API key sent as
a Bearer credential. Dashboard login credentials are never sent to content API
routes. Create a separate named key for each integration so it can be rotated or
revoked without interrupting other clients.

## Documentation formats on each instance

When **API access** and **Publish API docs** are both enabled, replace
`<site-url>` with that microfeed site's public URL. The URLs below link to the
always-public microfeed.org demo:

| Resource | URL |
| --- | --- |
| Interactive API docs | [`<site-url>/api/v1/`](https://www.microfeed.org/api/v1/) |
| OpenAPI JSON | [`<site-url>/api/v1/openapi.json`](https://www.microfeed.org/api/v1/openapi.json) |
| OpenAPI YAML | [`<site-url>/api/v1/openapi.yaml`](https://www.microfeed.org/api/v1/openapi.yaml) |
| Compact agent reference | [`<site-url>/api/v1/llms.txt`](https://www.microfeed.org/api/v1/llms.txt) |
| Self-contained agent reference | [`<site-url>/api/v1/llms-full.txt`](https://www.microfeed.org/api/v1/llms-full.txt) |

Public docs do not reveal API keys. The interactive public page describes the
contract but does not persist authentication. Older `/json/openapi.html` and
`/json/openapi.yaml` links redirect to the new locations only while public API
docs are enabled.

## Choose your next step

- [Enable API access or create an API key](./authentication/).
- [Build and test an integration](./build-and-test/).

This documentation page is the stable central overview. The generated
per-instance files remain the source of truth for the exact microfeed release
an integration is calling; the docs site does not keep a duplicate OpenAPI
specification.
