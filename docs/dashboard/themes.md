---
title: Themes and website code
description: Customize the public site with shared code or safely preview and activate immutable theme versions.
---

Open **Settings → Website appearance & code** to choose between two ways to
customize the public site:

- **Manage versioned themes** controls the structure and design of feed, item,
  Page, Search, and RSS views.
- **Edit shared HTML code across web pages** adds the same HTML, CSS, or
  JavaScript around whichever theme is active.

For a small visual change, choose **Create new version** on the active theme,
edit the design tokens near the top of **Web header**, preview the result, save
the draft, install it, and then activate it.

## Choose the right tool

| Tool | Best for | How the live site changes |
| --- | --- | --- |
| Versioned theme | Page structure, responsive design, navigation, search, and RSS styling | Create and preview a draft, install an immutable version, then activate it separately. |
| Shared website code | Analytics, pixels, global CSS or JavaScript, branding, and snippets that should survive theme changes | Select **Update** in the code editor; the saved code immediately wraps the active theme. |

## Edit shared website code

The shared code editor has three insertion points:

| Slot | Where it appears | Typical uses |
| --- | --- | --- |
| **Web Header** | Immediately before `</head>` | Analytics, metadata, `<style>` blocks, and scripts that belong in the document head. |
| **Web Body Start** | Immediately after `<body>` | Shared navigation, announcements, or branding above the theme. |
| **Web Body End** | Immediately before `</body>` | Shared footer content, deferred scripts, or site-wide links. |

Shared code is not part of a theme version and has no isolated preview or
automatic version history. Save the current code elsewhere before a large
edit, change one concern at a time, select **Update**, and use **View live
page** to check feed, item, Page, and Search views at mobile and desktop widths.

Anything placed in shared code is sent to public browsers. Never include API
keys, Cloudflare tokens, dashboard credentials, private setup links, or other
secrets. Remove a snippet if it interferes with navigation, readability, feed
metadata, or the active theme.

## Manage versioned themes

Every installed version is immutable. Editing creates a draft and then a new
version; it never changes an installed row in place. Only one version is
active, and installing another version does not change the public site.

Theme cards show the package's optional short description before the folded
details. Authors use this summary to explain what the theme is good for and
which content types or layouts it supports.

Themes are full-trust, owner-installed code. An activated theme can run the
same browser HTML, CSS, and JavaScript as shared website code. Install only
packages and versions you trust.

The Themes screen separates the catalog into two tabs:

- **Built-in themes** groups versions by their `microfeed.*` package lineage.
  The current checkout release appears first, and preserved older releases are
  available under **Version history**. Deployment synchronizes these packages,
  so Admin never offers a Delete action for them.
- **Custom themes** contains Admin-created, GitHub, local-directory, and
  migrated versions. Drafts appear first, while search, sorting, counts, and
  pagination apply only to installed Custom versions.

The URL records `tab=built-in` or `tab=custom`. Without an explicit tab, Admin
opens the tab containing the active theme and otherwise starts with Built-in
themes.

The catalog currently includes Default for a general-purpose feed, Podcast for
audio shows, Editorial Blog for essays and rich text, and Photo Grid for
image-led galleries. Fresh initialization installs all of them but activates
only Default. Existing deployments synchronize a missing or newer Built-in
release as inactive, so the public site never changes appearance automatically.

### Create a new version in Admin

Open **Settings → Themes** and select **Create new version** on the theme you
want to change:

1. Edit any of the theme slots and save the draft repeatedly.
2. Open the isolated preview for feed, item, Page, Search, RSS, mobile, and
   desktop views.
3. Choose a new semantic version, such as `1.2.1`.
4. Select **Install** to create an immutable, inactive version.
5. Preview the installed version and activate it only after approval.

Saving or installing a draft never changes public output. Activation
confirmation identifies the package, version, source, commit when available,
and checksum.

Expand **Theme details** to edit the optional **Short description**. It is
limited to 280 characters and is shown on the installed theme card after the
draft becomes a version.

For format v2 drafts, **Search result links** selects where item results open
in both the search popup and the Search page: the local microfeed item page, an
item's custom URL, or its media attachment. Expand **Theme details** to find
this setting. Each option identifies the corresponding JSON Feed and RSS field:
`items[]._microfeed.web_url` and the fallback RSS item link for the local page,
`items[].url` and RSS `<item><link>` for Item URL, or
`items[].attachments[0].url` and RSS `<item><enclosure url="…">` for Media
attachment. Items without the selected custom value fall back to their local
item page, and Page results always stay local. The selector is saved with the
draft and shown in its isolated preview before the new version is installed.
Admin intentionally exposes only supported theme metadata, behavior settings,
and text slots—not raw manifest JSON or packaged file, asset, and package
identity fields.

The bundled Default theme exposes a readable `microfeed-design-tokens` block
near the top of **Web header**. Change its accent, background, surface, text,
muted, and border values for a focused color update without editing compiled
CSS.

### Preview, activate, roll back, or delete

Use **Preview** before activating any installed version. Activation records the
previous version so an operator can roll back with `yarn manage theme rollback`
if the new design causes a problem. Delete only inactive Custom versions that
are no longer needed; the active version and every Built-in version are
protected from manual deletion.

When a theme packages its own preview fixture, each newly opened preview starts
with **Demo content** so the theme can demonstrate its supported content and
layout. Switch to **Current site** to render the instance's published feed.
That choice applies to Feed, Item, Search, and RSS and stays selected while you
change views, viewport size, or open the preview in a new tab. Page and
navigation examples remain synthetic. Themes without a fixture use Current
site data.

An environment can keep up to 100 non-deleted Custom versions and 20 drafts.
Built-in versions do not consume this quota. If a limit is full, delete an
unused inactive Custom version or draft and retry.

Repository-installed themes are managed from the connected clone with `yarn
manage theme`. The [Build and release a theme](/themes/) guide covers creating,
exporting, validating, installing, updating, and rolling back standalone theme
packages.

## Pages and Search compatibility

Format v1 themes continue rendering feed and item pages but do not expose
standalone Pages or public search. Admin allows Page drafts under a format v1
theme but requires an active format v2 theme before a Page can be Published or
Unlisted.

Format v2 adds Page and Search templates. The bundled Default theme is the
current reference implementation. If an older site still uses a format v1
theme, install and preview a format v2 version before activating it; updating
microfeed never silently changes the active theme.

## Storage and backups

D1 stores installed theme versions, drafts, their optional preview fixtures,
and active/previous state. R2 is optional for text-only themes and stores
declared package assets when a theme uses them. Portable snapshots include the
theme records and the complete R2 bucket, so installed versions, drafts,
preview fixtures, state, and packaged assets restore together. Theme
initialization and export also write a declared preview fixture back into the
portable package.

For authoring details, continue with:

- [Build and release a theme](/themes/).
- [Theme contract and rendering](/themes/contract/).
- [Bundle CSS, JavaScript, and assets](/themes/assets/).
- [`@microfeed/theme-kit` reference](/theme-kit-cli/).
