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

<img width="1770" height="1094" alt="Screenshot 2026-09-22 at 1 25 33 PM" src="https://github.com/user-attachments/assets/39321203-cbdd-4e6f-8028-26ea62bf25a4" />
<img width="1770" height="1094" alt="Screenshot 2026-09-22 at 1 24 26 PM" src="https://github.com/user-attachments/assets/b088d2f7-c360-4776-a9a5-6787dfc5e281" />


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

<img width="1770" height="1094" alt="Screenshot 2026-09-22 at 1 25 33 PM" src="https://github.com/user-attachments/assets/7e53c776-f5e2-46f2-a10a-47628515c94f" />


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

Use **Add author** to open the author dialog, or **Edit** beside an existing
author. Name, type, and profile URL stay in the dialog until **Save author**
validates and applies them. Cancel, Escape, and the close button discard the
dialog's changes. Item edits then use normal autosave; channel edits use the
channel's **Save** button.

Item authors replace channel default authors when configured. Clearing them
restores channel defaults. Choose **Item language** from the same searchable
language selector used by the channel editor, or select **Inherit from channel**
to use the channel language. The new bundled Default theme and generic starter display author
attribution; installed theme versions are not changed or activated automatically.

Automatic SEO descriptions use the first 160 Unicode characters of plain-text
content, including an ellipsis when truncated. The editor shows this same fallback
in its placeholder, character count, and preview. Custom descriptions are kept
as entered; the 160-character guidance is not a hard limit.

The **Link** field above the item body controls both the address in RSS/JSON Feed
and the page's canonical URL—the preferred version suggested to search engines.
Leave it blank to use the local item URL. When republishing the same article,
set Link to the original article's HTTP or HTTPS URL. Feed readers open that
address, and the canonical tag, Open Graph URL, and generated structured data
use it. URL fragments are omitted from canonical metadata.

The local page remains accessible without redirecting. Change **Item URL** to
edit its local address. An item pointing to a different canonical URL is excluded
from the generated sitemap. Use Link for the preferred version of the content;
put related links and source citations in the body. Search engines may select a
different canonical. Unlisted items remain accessible directly with `noindex`,
and drafts remain private.

## Add podcast transcripts and chapters

Open **Podcast-specific fields** on an item to add:

- **Transcripts:** upload a timed VTT or SRT file up to 10 MB, or enter an
  existing HTTPS URL and choose its format and language. Multiple languages
  and formats are supported. With no language override, podcast apps use the
  channel language. Apple Podcasts may also require selecting publisher-provided
  transcripts in Podcasts Connect.
- **Chapters:** enter a start time and title, with an optional image and link.
  Times accept `HH:MM:SS`, `MM:SS`, or seconds, including fractional seconds.
  Or select **Upload chapter JSON** to import the whole list. Entries are sorted
  by time, and duplicate start times are rejected.
- **Hosts, guests, and credits:** add episode participants, or copy the channel
  participants before adding a guest. An episode list replaces the complete
  channel list; clear it to inherit again.
- **Content license:** override the channel license for this episode. Remove
  the override to inherit the channel license.

Save an entry in its dialog to apply it to the item and start the usual
five-second autosave. Cancelling a dialog leaves the item's metadata unchanged.
Media uploads finish before the entry can be saved; uploaded files remain in media
storage even if you cancel. Photos and chapter images accept JPEG or PNG files
up to 8 MB. Existing URLs work without connected media storage.

For chapter imports, choose a `.json` file up to 1 MB containing a chapter array
or an object like this:

```json
{
  "version": "1.2.0",
  "chapters": [
    {"startTime": 0, "title": "Introduction"},
    {"startTime": 90.5, "title": "Interview", "url": "https://example.com/notes/"}
  ]
}
```

Each chapter needs a numeric `startTime` in seconds and a `title`. Optional
`img` and `url` values must be HTTPS links. Other chapter fields are rejected;
episode-level document metadata is not imported. The existing limit of 100
chapters and 64 KiB of total podcast metadata still applies.

Review the preview, then select **Import chapters** or **Replace chapters**.
Replacing applies to the complete existing list. Invalid files and Cancel
leave your chapters unchanged. The file is read in your browser, so this works
without media storage; only the validated entries enter the normal item
autosave. You can edit imported chapters individually afterward.

microfeed generates a chapter JSON file at `/i/<item-id>/chapters.json` and adds
its address to RSS. The address stays the same when the item's title or URL
changes. The file is available for Published and Unlisted items while the feed
and RSS are enabled; it is unavailable for drafts, deleted items, or offline
feeds. Changing chapters does not modify the audio file. Linked and uploaded
media have their own public URLs, independent of the item's visibility.

After saving, inspect the item's RSS and JSON links in **Public access**.
Playback features depend on the listener's podcast app. The field headings
explain the exported tags and JSON fields.
