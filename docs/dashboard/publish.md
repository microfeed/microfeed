---
title: Create and edit items
description: Publish text, links, images, audio, video, and documents yourself or with a coding agent.
---

An **item** is one entry in your channel. Publishing it can create a public web
page and add an entry to both RSS and JSON feeds.

People can use the visual admin dashboard described below. For repeatable or
agent-driven publishing, the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli) manages the
same channel after its owner enables the authenticated API. Start with
[Manage content with the microfeed CLI](/api/cli/).

## Create an item

1. Select **Add item** in the dashboard navigation.
2. Choose the item type or media fields appropriate for the content.
3. Add a clear title and description. The visual editor supports formatted
   text; the HTML source view is available when you need direct markup.
4. Add an external URL or upload media when appropriate.
5. Review the publication date, generated link, and item status.
6. Leave the item **Unpublished** while you prepare it, or select **Published**
   when it is ready to go live.

Opening the form does not create an empty item. Your first genuine edit creates
one **Unpublished** draft, changes the browser address from `/items/new/` to the
draft's edit address, and adds it to **See all items**. Ordinary edits autosave
after a one-second pause; status choices and completed uploads save immediately.

The action panel reports **Unsaved changes**, **Saving…**, or **All changes
saved**. Select **Save now** to save without waiting. If a save fails, the form
retains your changes and offers **Retry save**. Keep the page open until the
latest changes are saved.

Selecting **Published** is an explicit action that saves immediately and makes
the item public. If you have not changed the draft's displayed publication date,
the dashboard updates it to the publication time. A date you chose yourself is
preserved. If public visibility is enabled, use the external link to inspect the
page.

![Creating a new microfeed item with media type, upload, image, title, publication, visibility, and description controls](/images/screenshots/2-dashboard-2-add-item.png)

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
3. Change the fields and wait for **All changes saved**, or select **Save now**.

The editor preserves the item's current Published, Unlisted, or Unpublished
status when it opens. Changes to an existing item follow the same autosave and
retry behavior as a new draft.

Deletion uses a confirmation dialog because it may remove both the item record
and associated media. Read the target carefully before confirming.

## Publish with a coding agent

Give the agent a content goal and the root URL of your microfeed site. Do not
give it an API key or OAuth token. For example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if API access must be
enabled, browser authorization is required, or a destructive action needs
confirmation.
```

Inside a microfeed clone, the agent should prefer `yarn microfeed`. Elsewhere,
it can use a project-local installation or `yarn dlx @microfeed/cli`. You sign
in and approve OAuth permissions in the browser; the CLI stores and refreshes
the credential without printing it. First [enable API access and OAuth for the
CLI](/api/authentication/), then see the [agent workflow](/api/ai-agents/) and
complete [`yarn microfeed` command reference](/microfeed-cli/) for media
vocabulary, deterministic input, and deletion safeguards.

## Verify distribution

After publishing, check:

- The item’s public page.
- `/rss/` in a browser or feed reader.
- `/json/` for the structured representation.

If the dashboard saves successfully but the public page is unavailable, review
the channel’s access-control setting and item visibility first.
