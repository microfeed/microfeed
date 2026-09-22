---
title: Edit channel
description: Update the channel image, title, publisher, website, categories, language, and description.
---

Use **Edit channel** to change the identity and description shared by your
public website and feeds.

## Update channel details

1. Select **Edit channel** in the left navigation.
2. Update the channel image, title, publisher, website, categories, language,
   or description.
3. Select **Save changes** when the channel is ready to update.

The action panel reports **Unsaved changes**, **Saving…**, or **All changes
saved**. Channel changes are never saved on a timer, including image uploads
and selection changes. If a save fails, your edits remain in the form and the
action changes to **Retry save**. Keep the page open until the latest changes
are saved.

![Editing a microfeed channel image, title, publisher, website, categories, language, and description](https://media-cdn.microfeed.org/production/themes/0caa54c6-a365-4d18-94fb-d2b317b966c2/assets/admin-edit-channel.png)

## Keep the copyright year current

In **Podcast-specific fields**, the **Copyright** field accepts the built-in
`{{current_year}}` variable and new channels start with
`© {{current_year}}`. Add a publisher name after it when appropriate:

```text
© {{current_year}} Example Publisher
```

microfeed saves the variable rather than one fixed year. When it produces the
public website, JSON feed, or RSS feed, it replaces the variable with the
current UTC year. During 2026, the example publishes as
`© 2026 Example Publisher`. The value changes at midnight UTC on January 1;
the existing public cache can retain the previous year for about five minutes.

Only `{{current_year}}` is supported in the Copyright field.
Existing channels with a fixed year are not changed automatically. Replace the
year with `{{current_year}}` once if you want that channel to update itself in
future years.

## Check the public destinations

Use the **Public access** links beside the form to open the website, RSS feed,
or JSON feed. Confirm that the channel title, image, and description appear as
expected after saving. Channels do not have a separate draft state: selecting
**Save changes** updates the public channel immediately.

The **Website** field is channel metadata. It does not change the address where
the microfeed instance is deployed. To attach or change a custom domain, see
[Domains and authentication](/manage/domains-and-access/).

## Channel image and favicon

The channel image is also the fallback favicon. If you upload a separate
favicon under **Settings**, public pages use that image instead. See
[Media and feeds: Favicon](/dashboard/media-and-feeds/#favicon).

## Customize search and social previews

Open **SEO / GEO** below **Podcast-specific fields**. The section starts
collapsed. Set an SEO title and description for the homepage, or clear them to
use the channel title and description. These settings do not change visible
content or podcast metadata. The character counts are guides, not ranking rules
or guaranteed display lengths.

Upload a social image and crop it to **1200 × 630**. Cropping happens in your
browser; only the crop is uploaded. Opaque images become JPEG, and transparent
images stay PNG. The result must be smaller than 5 MB. A warning appears when a
small crop needs enlargement. Optional alt text describes the social image.
Without this override, the homepage uses channel cover art.

Publisher identity reuses the **Publisher** name above. Choose Person or
Organization only when appropriate, and optionally add a profile URL and
official profile links. Default authors are separate: their names and profile
URLs provide item attribution without changing `itunes:author`. Leave unknown
identity information unset.

Select **Save changes**, then inspect the approximate previews and the public
page. Search and social platforms can choose different snippets. These ordinary
metadata and identity fields also help systems that summarize web content;
there are no special AI ranking fields or promises of inclusion.

## Podcast participants, support, and licensing

Open **Podcast-specific fields** to add regular hosts and contributors under
**Hosts, guests, and credits**. Each person has a name, role, and optional
profile URL and photo. These credits are separate from the Publisher and SEO
authors. Episodes inherit the channel participants unless they supply their own
complete list.

**Support the show** accepts multiple labeled donation or membership links.
**Content license** offers common Creative Commons licenses and All rights
reserved, or a custom identifier with a URL to the full terms. Episodes can
override the channel license.

**Feed import lock** asks other hosting platforms to reject imports of your
feed. It is advisory and does not make the feed private. Choose Unlocked before
moving to another host; Unspecified omits the signal.

Save each entry in its dialog, then select **Save changes** on the channel.
The field headings open explanations with RSS and JSON examples. See
[Podcast fields in feeds](/dashboard/media-and-feeds/#podcast-fields-in-feeds)
for interoperability details.
