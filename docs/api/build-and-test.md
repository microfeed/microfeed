---
title: Build and test integrations
description: Use generated examples, API Explorer, cursor pagination, and the media upload flow safely.
---

Start with an API key created for this integration and the generated contract
from the exact instance you will call.

## Test in the dashboard

Open **API → API Explorer**, choose an API key, and select an operation. The
explorer keeps the selected key in memory and does not store it. Requests stay
disabled until API access is on and a key is selected.

For a smaller first test, **API Overview** provides JavaScript and cURL examples
for the feed endpoint. Choose a key and run the example from the dashboard.

## Call the API from code

Use the instance origin, `/api/` base path, and Bearer authentication:

```js
const response = await fetch("https://feed.example.com/api/feed/?limit=3", {
  headers: {
    Authorization: `Bearer ${process.env.MICROFEED_API_KEY}`,
  },
});

if (!response.ok) throw new Error(`microfeed returned ${response.status}`);
const feed = await response.json();
```

Keep the key in your platform’s secret manager or environment configuration,
not in source code.

## Follow pagination links

Feed responses can include `next_url` and `prev_url`. Follow those exact URLs
instead of constructing cursors yourself. To start a listing, choose
`sort=created_at|updated_at|published_at`, `order=asc|desc`, and a supported
`limit` documented by the current OpenAPI file.

## Upload media

Media upload is a three-part flow:

1. Call `POST /api/media_files/presigned_urls/` with the file category, intended
   item ID, and local filename information required by the schema.
2. `PUT` the raw file bytes to the returned short-lived `presigned_url`.
3. Save the returned `media_url` on the item or channel through the appropriate
   API operation.

The upload URL is same-origin and short-lived. A 503 response means media
storage is unavailable for this instance; do not invent a different bucket or
upload destination.

## Design for changes

- Generate clients or validate requests against the instance’s current
  `/api/openapi.json` or `/api/openapi.yaml`.
- Treat unknown response fields as forward-compatible additions.
- Handle documented 400, 401, 404, and 503 responses explicitly.
- Do not scrape the admin dashboard or reuse its browser session.
- Use a unique named API key so the instance owner can rotate or revoke only
  this integration.
