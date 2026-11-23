---
title: Public tags
description: Organize items with public tags and offer a separate page, RSS, and JSON Feed for each tag.
---

Tags let readers follow a topic across your items. An item can have several
tags. Tags are always public: creating one immediately exposes its name and
plain-text description, even when it has no published items. There is no tag
visibility setting.

## Create and assign tags

Open **Admin → Tags** and select **Add tag**. Enter a name and, optionally, a
URL slug and description in the popup editor. Existing tags appear in a table;
select **Edit** to open the same editor for a tag.
Names must be unique and contain at most 50 Unicode characters after trimming
and normalization. The live counter counts Unicode code points, not bytes.
If a name is too long, microfeed shows “Tag name must be 50 characters or
fewer.” Your input is preserved; shorten it yourself before saving.

The generated slug supports Unicode letters and numbers. Slugs are unique,
limited to 100 characters, and remain unchanged when you edit a name. Changing
a slug keeps historical public tag page and feed addresses redirecting to the
new slug. Historical addresses stay reserved, including after deletion.

In the item editor, type in **Tags** to search, then select matching tags.
Selected tags appear as compact chips; use a chip's remove button to unassign
it without deleting the tag. You can also use the arrow keys and Enter to
select tags, or focus a chip and press Backspace or Delete to remove it.

When no tag has the same name, choose **Create “name”** to create and select
one without leaving the editor. The same 50-character limit applies. Creation
is explicit: typing a name alone does not create anything. A new tag is public
immediately, even if the item is still a draft or you leave without saving it.
Use **Manage tags** to edit descriptions and slugs in a separate tab.

Published items appear on each assigned tag's page and in its feeds. Unlisted and
Draft items do not. Their assignments remain saved when visibility changes.

Deleting a tag removes its assignments, not its items. Deleted tag pages
and feeds return Not Found.

## Browse and subscribe

The **All tags** page at `/tags/` lists all tags alphabetically, including
empty tags, with descriptions and published-item counts. Each tag has:

- `/tags/<slug>/`: its tag page, showing published items with that tag;
- `/tags/<slug>/rss/`: its RSS feed;
- `/tags/<slug>/json/`: its JSON Feed.

Tag pages use the site's existing item sorting and pagination. Item addresses
and RSS GUIDs remain the same in every feed. The site's offline/headless and
RSS/JSON subscription settings still apply.

Updated built-in themes show linked tags with a small tag icon on individual
item pages, not on feed item cards. In themes with item subscription links,
tags appear below those links. Individual tag pages have a **Browse tags**
section above the footer, with up to eight tags alphabetically and an **All tags**
link to `/tags/`. This section does not appear on the feed, item, standalone
Page, Search, or All tags pages. The top navigation bar does not include tags.
Each built-in theme includes an All tags layout with its own typography,
content alignment, and subscription links, including in isolated previews.

An individual tag page starts with the same back link as the item page, the tag
name, its feed subscription links, and its description when present. Feed
links appear above the description. It does not repeat the feed's cover art,
author introduction, or About section.

Updating microfeed does not automatically activate a newer theme
version on an existing site. Choose the new built-in version in Admin when
you are ready. Custom themes can declare optional `webTag` and `webTags`
templates for the individual tag page and the All tags page. In an Admin theme draft, open
**Tag page** or **All tags** and select **Create custom template**.
Without an override, tag pages reuse the theme's Feed template and the
All tags page uses microfeed's markup. See the
[tag render context](/themes/contract/#render-tags) for fields and examples.

Public search includes tag names and descriptions as separate results. A tag
name does not make its assigned items match that search. Item visibility and
publication-date filters do not apply to tags.

## Use the API or CLI

Authenticated tag operations use Bearer credentials with `content:read` or
`content:write`. Look up tags by current slug at `/api/v1/tags/<slug>/`, or by
immutable ID at `/api/v1/tags/by-id/<id>/`. Historical API slugs return 404;
only public URLs redirect. The instance's generated API reference describes
the exact request and response schemas.

From a repository clone, these commands use the local CLI:

```console
yarn microfeed tag create --name "Release notes" --slug releases --json
yarn microfeed tag list --json
yarn microfeed item update <item-id> --tag releases --tag tutorials --json
yarn microfeed item search releases --types tags --json
```

Item API writes accept either `tag_slugs` or `tag_ids`, never both. An omitted
field keeps assignments, an empty array clears them, and an array replaces
them. Unknown references reject the entire item change. See the
[CLI reference](/microfeed-cli/#npx-microfeedcli-tag) for all options.

## Events, backups, and upgrades

Webhooks include `tag.created`, `tag.updated`, and `tag.deleted`. Membership
changes emit `item.updated` with `tags` in `changed_fields`; other item
lifecycle snapshots include tag references. Renaming or deleting a tag emits
one tag event, without an event for every assigned item. Published-item count
changes do not emit tag events.

Portable snapshots preserve tags, memberships, and historical slugs. Older
snapshots restore without tags. Search rebuilds include tag text.

The `/tags/` root is reserved. Before an upgrade, the management tool checks
existing Pages, historical Page paths, and the admin path. If one already owns
`tags`, the upgrade stops and reports the conflict. Renaming a Page alone
does not release its historical path; resolve ownership explicitly before
retrying. microfeed never silently renames or shadows existing routes.
