---
title: Build and test integrations
description: Use generated examples, API Explorer, cursor pagination, and the media upload flow safely.
---

Start with a named API key created for this integration and the generated
contract from the exact microfeed instance you will call. Send the key in the
`Authorization: Bearer` header on every authenticated request.

## Test in the dashboard

Open **API → API Explorer**, choose an API key, and select an operation. The
explorer keeps the selected key in memory and does not store it. Requests stay
disabled until API access is on and a key is selected.

For a smaller first test, **API Overview** provides JavaScript and cURL examples
for the feed endpoint. Choose a key and run the example from the dashboard.

## Call the API from code

Use the microfeed site URL, `/api/v1/` base path, and Bearer authentication:

```js
const response = await fetch("https://feed.example.com/api/v1/feed/?limit=3", {
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

microfeed distinguishes two item fields:

- `image` is item cover art or a thumbnail.
- `attachments[0]` is the one main audio, video, document, image, or external
  link. JSON Feed exposes it as an attachment and RSS exposes it as
  `<enclosure>`.

The REST upload is a three-part flow:

1. Call `POST /api/v1/media_files/presigned_urls/` with the file category, intended
   item ID, MIME type, size, and local filename information required by the
   schema. Include `item_id` for attachments and all standalone audio, video,
   or document uploads. It may be omitted for standalone or cover images.
2. `PUT` the raw file bytes to the returned short-lived `presigned_url` without
   a Bearer credential.
3. Save the returned `media_url` inside `content_html`, as
   `attachments[0].url`, as `image`, or as the channel icon through the
   appropriate API operation. Include attachment category, MIME type, byte
   size, and optional audio/video duration when populating an attachment.

The upload URL is same-origin and short-lived. A 503 response means media
storage is unavailable for this instance; do not invent a different bucket or
upload destination. Do not log or persist the short-lived URL.

## Design for changes

- Generate clients or validate requests against the instance’s current
  [OpenAPI JSON](https://www.microfeed.org/api/v1/openapi.json) at
  `/api/v1/openapi.json` or [OpenAPI YAML](https://www.microfeed.org/api/v1/openapi.yaml)
  at `/api/v1/openapi.yaml`.
- Treat unknown response fields as forward-compatible additions.
- Handle documented 400, 401, 403, 404, and 503 responses explicitly.
- Do not scrape the admin dashboard or reuse its browser session.
- Use a unique named API key so the instance owner can rotate or revoke only
  this integration.
