---
title: Public tags
description: Organize items with public tags and offer a separate archive, RSS, and JSON Feed for each tag.
---

Tags let readers follow a topic across your items. An item can have several
tags. Tags are always public: creating one immediately exposes its name and
plain-text description, even when it has no published items. There is no tag
visibility setting.

## Create and assign tags

Open **Admin → Tags**. Enter a name and, optionally, a URL slug and description.
Names must be unique and contain at most 50 Unicode characters after trimming
and normalization. The live counter counts Unicode code points, not bytes.
If a name is too long, microfeed shows “Tag name must be 50 characters or
fewer.” Your input is preserved; shorten it yourself before saving.

The generated slug supports Unicode letters and numbers. Slugs are unique,
limited to 100 characters, and remain unchanged when you edit a name. Changing
a slug keeps historical public archive and feed addresses redirecting to the
new slug. Historical addresses stay reserved, including after deletion.

In the item editor, select existing tags in **Tags**. Create new tags in the
tag manager first; entering an item does not implicitly create a tag.
Published items appear in each assigned tag's archive and feeds. Unlisted and
Draft items do not. Their assignments remain saved when visibility changes.

Deleting a tag removes its assignments, not its items. Deleted tag archives
and feeds return Not Found.

## Browse and subscribe

The public directory at `/tags/` lists all tags alphabetically, including
empty tags, with descriptions and published-item counts. Each tag has:

- `/tags/<slug>/`: its item archive;
- `/tags/<slug>/rss/`: its RSS feed;
- `/tags/<slug>/json/`: its JSON Feed.

Archives use the site's existing item sorting and pagination. Item addresses
and RSS GUIDs remain the same in every feed. The site's offline/headless and
RSS/JSON subscription settings still apply.

Updated built-in themes include Tags navigation and linked tags on item cards
and pages. Updating microfeed does not automatically activate a newer theme
version on an existing site. Choose the new built-in version in Admin when
you are ready. Custom themes can declare optional `webTag` and `webTags`
templates for archives and the directory. In an Admin theme draft, open
**Tag archive** or **Tags directory** and select **Create custom template**.
Without an override, archives reuse the theme's Feed template and the
directory uses microfeed's markup. See the
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
