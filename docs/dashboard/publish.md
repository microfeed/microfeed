---
title: Create and edit items
description: Publish text, links, images, audio, video, and documents from the dashboard.
---

An **item** is one entry in your channel. Publishing it can create a public web
page and add an entry to both RSS and JSON feeds.

## Create an item

1. Select **Add item** in the dashboard navigation.
2. Choose the item type or media fields appropriate for the content.
3. Add a clear title and description. The visual editor supports formatted
   text; the HTML source view is available when you need direct markup.
4. Add an external URL or upload media when appropriate.
5. Review the public-page and feed settings.
6. Select the save or publish action.

Expected result: a success notification appears, and the item becomes available
from the channel’s item list. If public visibility is enabled, use the external
link to inspect the page.

## Upload media

Media uploads require an R2 bucket attached to the instance. If the uploader is
unavailable, check the R2 state with `yarn manage status`. For a content-only
instance, run `yarn manage deploy --enable-r2` only after R2 is available in the
correct Cloudflare account.

Use meaningful titles and descriptions even when an image, audio file, or video
carries most of the content. Text improves accessibility, search, and feed-reader
context.

## Edit or remove an item

1. Select **See all items**.
2. Find the item, then open its edit action.
3. Change the fields and save.

Deletion uses a confirmation dialog because it may remove both the item record
and associated media. Read the target carefully before confirming.

## Verify distribution

After publishing, check:

- The item’s public page.
- `/rss/` in a browser or feed reader.
- `/json/` for the structured representation.

If the dashboard saves successfully but the public page is unavailable, review
the channel’s access-control setting and item visibility first.
