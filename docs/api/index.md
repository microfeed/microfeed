---
title: API overview
description: Use microfeed as a headless CMS with named API keys, generated OpenAPI documents, and agent-ready references.
---

microfeed has two structured interfaces with different purposes:

- The public **JSON Feed** at `/json/` lets readers and software consume
  published channel content without a credential.
- The optional authenticated **API** under `/api/v1/` lets integrations read,
  create, update, and delete content, update the primary channel, and prepare
  media uploads.

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
| `PUT /api/v1/channels/primary/` | Update the primary channel. |
| `POST /api/v1/media_files/presigned_urls/` | Prepare a short-lived, same-origin media upload. |

![The microfeed API Explorer showing parameters, JavaScript fetch code, and the response schema for fetching a feed](/images/screenshots/3-api-1.png)

Every integration request requires an active API key sent as a Bearer
credential. Dashboard login credentials are never API credentials.

## Documentation formats on each instance

When **API access** and **Publish API docs** are both enabled, replace
`<site-origin>` with that instance’s public origin. The URLs below link to the
always-public microfeed.org demo:

| Resource | URL |
| --- | --- |
| Interactive API docs | [`<site-origin>/api/v1/`](https://www.microfeed.org/api/v1/) |
| OpenAPI JSON | [`<site-origin>/api/v1/openapi.json`](https://www.microfeed.org/api/v1/openapi.json) |
| OpenAPI YAML | [`<site-origin>/api/v1/openapi.yaml`](https://www.microfeed.org/api/v1/openapi.yaml) |
| Compact agent reference | [`<site-origin>/api/v1/llms.txt`](https://www.microfeed.org/api/v1/llms.txt) |
| Self-contained agent reference | [`<site-origin>/api/v1/llms-full.txt`](https://www.microfeed.org/api/v1/llms-full.txt) |

Public docs do not reveal API keys. The interactive public page describes the
contract but does not persist authentication. Older `/json/openapi.html` and
`/json/openapi.yaml` links redirect to the new locations only while public API
docs are enabled.

## Choose your next step

- [Enable access and create an API key](./authentication/).
- [Build and test an integration](./build-and-test/).
- [Give an AI agent the self-contained API contract](./ai-agents/).

This documentation page is the stable central overview. The generated
per-instance files remain the source of truth for the exact microfeed release
an integration is calling; the docs site does not keep a duplicate OpenAPI
specification.
