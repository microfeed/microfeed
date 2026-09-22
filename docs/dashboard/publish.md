---
title: Create and edit items
description: Publish text, links, images, audio, video, and documents yourself or with a coding agent.
---

An **item** is one entry in your channel. Publishing it can create a public web
page and add an entry to both RSS and JSON feeds.

You can complete the whole workflow in the visual Admin dashboard. For repeatable or
agent-driven publishing, the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli) manages the
same channel after its owner enables the authenticated API. Start with
[Manage content with the microfeed CLI](/automation/cli/).

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
after a five-second pause. Published, Unlisted, and Unpublished status choices,
plus completed media uploads and replacements, save immediately. Other field
and selection changes use the five-second pause.

The action panel reports **Unsaved changes**, **Saving…**, or **All changes
saved**. Select **Save now** to save without waiting. If a save fails, the form
retains your changes and offers **Retry save**. Keep the page open until the
latest changes are saved.

Selecting **Published** is an explicit action that saves immediately and makes
the item public. If you have not changed the draft's displayed publication date,
the dashboard updates it to the publication time. A date you chose yourself is
preserved. If public visibility is enabled, use the external link to inspect the
page.

![Creating a new microfeed item with media type, upload, image, title, publication, visibility, and description controls](https://media-cdn.microfeed.org/production/media/rich-editor/items/sJQ1j_8by7r/image-a60d5e0fcf04fa16e342cc7a4522f1bf.png)

## Upload media

Media uploads require an R2 bucket attached to the instance. If the uploader is
unavailable, check the R2 state with `npx @microfeed/cli manage status`. For a
content-only instance, run `npx @microfeed/cli manage deploy --enable-r2` only
after R2 is available in the correct Cloudflare account.

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
give it an API key or CLI credential. For example:

```text
Use `npx @microfeed/cli` to create a published item on
https://feed.example.com. Use `--json` for deterministic output, and pause for
me if API access must be enabled, browser authorization is required, or a
destructive action needs confirmation.
```

The recommended `npx @microfeed/cli` command works from any folder. Inside a
Git-cloned microfeed source repository whose dependencies are installed,
`yarn microfeed` is a shortcut to the local CLI version. You sign in and
approve permissions in the browser; the CLI stores and refreshes the credential
without printing it. Follow the [guided CLI
workflow](/automation/cli/), then see the [agent workflow](/automation/ai-agents/)
and complete [`@microfeed/cli` reference](/microfeed-cli/) for media vocabulary,
deterministic input, and deletion safeguards.

## Verify distribution

After publishing, check:

- The item’s public page.
- `/rss/` in a browser or feed reader.
- `/json/` for the structured representation.

If the dashboard saves successfully but the public page is unavailable, review
the channel’s access-control setting and item visibility first.

## Customize metadata and the item URL

Open **SEO / GEO** below **Podcast-specific fields**. Metadata overrides use the
same autosave as other item fields. SEO title and description affect the page's
head metadata; the visible title and article body stay unchanged. Clearing an
override restores its fallback.

New items use `/i/{slug}/`. Automatic slugs follow draft titles and freeze when
the item first becomes Published or Unlisted. To choose an address yourself,
edit **Item URL** and select **Apply URL**. Typing alone does not change the URL.
Unicode letters, combining marks, numbers, and hyphens are supported; slugs are
normalized to NFC and lowercase. Duplicate automatic slugs receive numeric
suffixes. A conflicting custom slug must be changed before it can be saved.

Existing items keep their earlier title-and-ID URLs until you explicitly apply
a new URL. Previous public HTML paths redirect directly to the current local
URL with HTTP 301. Deleted items keep their old paths reserved. Item IDs, RSS
GUIDs, and ID-based API, JSON, and RSS addresses do not change. Public JSON and
RSS also accept clean slugs.

An item social image overrides its cover; otherwise microfeed tries the item
cover, channel social image, and channel cover, in that order. Uploads use the
same browser crop and limits as [channel social images](/dashboard/edit-channel/#customize-search-and-social-previews).
Removing an override restores inheritance. Files referenced elsewhere are
retained when replacing or removing an image.

Item authors replace channel default authors when configured. Clearing them
restores channel defaults. An optional item language overrides the channel
language. The new bundled Default theme and generic starter display author
attribution; installed theme versions are not changed or activated automatically.

For republished work, set **Original-source canonical URL** to the original
article's absolute HTTP or HTTPS URL. The local page remains accessible. Its
canonical tag, Open Graph URL, and generated structured data use this value,
and the item is excluded from the generated sitemap when it points elsewhere.
This does not replace an explicit feed item link. Unlisted items remain
accessible directly with `noindex`, and drafts remain private.
