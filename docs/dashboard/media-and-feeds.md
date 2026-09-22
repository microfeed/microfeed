---
title: Media and feeds
description: Configure subscribe methods, media file URLs, public feed ordering, and the favicon under Settings.
---

Open **Settings** for the controls on this page. Editing the channel’s image,
title, publisher, website, categories, language, or description happens on the
separate [Edit channel](/dashboard/edit-channel/) page.

## Subscribe methods

Select **Subscribe methods** in the settings navigation. Subscribe methods are
public destinations such as RSS, JSON, Apple Podcasts, or another listening
service. For each method, set its name, URL, visibility, and order. Only
advertise a destination you have verified.

## Media file storage

The media address tells public pages how to reach uploaded files stored in R2.
Most sites should leave it unchanged. Update it only when you deliberately
change the bucket’s public address or add a custom media domain, then open an
existing image to verify the new address.

The deployment’s R2 connection is managed by `npx @microfeed/cli manage`;
changing this text field does not create, attach, or move a bucket or any files.

## Items settings

Choose the default sort field and order for the public feed. Those radio choices
save when changed. Set **Items per page** and select its adjacent **Update**
button to save a new page size.

Changing presentation order does not rewrite the items themselves.

## Favicon

Without a separate favicon, public pages use the channel image. Upload, replace,
or delete the favicon from its settings section; the action saves immediately.
Browsers cache favicons aggressively, so a replacement may need a hard refresh
or a new private window before it appears.

## SEO fields in feeds

JSON Feed exposes SEO overrides and rich identities under `_microfeed` at
channel and item level. Standard titles, descriptions, content, artwork, and
attachments retain their content meaning. Standard `authors` projects the
configured author names and profile URLs.

RSS retains its existing metadata and has no new SEO/GEO namespace. SEO
summaries and social images do not replace RSS descriptions or podcast artwork;
`itunes:author` continues to use the existing Publisher field. An explicit
item link stays unchanged. When no link is configured, RSS uses the current
local item URL, including a clean slug. Canonical overrides never replace RSS
links.

## Podcast fields in feeds

The channel and item editors support the
[Podcasting 2.0 namespace](https://github.com/Podcastindex-org/podcast-namespace).
RSS declares `xmlns:podcast="https://podcastindex.org/namespace/1.0"` and includes
only configured fields:

| Field | Location | RSS tag |
| --- | --- | --- |
| Transcripts | Item | `podcast:transcript` |
| Chapters | Item | `podcast:chapters` |
| Hosts, guests, and credits | Channel and item | `podcast:person` |
| Support the show | Channel | `podcast:funding` |
| Content license | Channel and item | `podcast:license` |
| Feed import lock | Channel | `podcast:locked` |

JSON Feed and the authenticated API expose these values under
`_microfeed.podcast`, using `transcripts`, `chapters`, `people`, `funding`,
`license`, and `locked`. The [API Explorer](/api/) supplies their current request
and response schemas. On API updates, omitted properties stay unchanged,
`null` clears a property, and a supplied list replaces that entire list.
Setting `podcast` to `null` clears all podcast extensions.

An item with no people or license override inherits those values from the
channel. JSON preserves the actual overrides; RSS readers apply channel
inheritance. Chapters are published as a version `1.2.0` JSON document with
content type `application/json+chapters`.

Each record supports up to 50 participants, 10 funding links, 10 transcripts,
and 100 chapters where those fields apply, within 64 KiB of podcast metadata.
Resource links require HTTPS, with HTTP allowed for localhost development.
These additions do not change existing iTunes fields, the main media enclosure,
SEO authors, or podcast cover art.
