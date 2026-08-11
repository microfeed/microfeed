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

![Editing a microfeed channel image, title, publisher, website, categories, language, and description](/images/screenshots/2-dashboard-2-edit-channel.png)

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
