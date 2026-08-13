---
title: Pages and Site Files
description: Publish standalone Pages and customize root-level text files.
---

microfeed separates website-only content from feed items. Use **Pages** for
documents such as About, Contact, or Resources. Use **Site Files** for raw
root-level text such as `robots.txt`, `llms.txt`, `sitemap.xml`, or a custom
`security.txt`.

## Create a Page

Open **Pages → Add Page** in Admin. The editor deliberately resembles the item
editor: it has the same visual/HTML content editor, plus website-specific
controls for the URL path, visibility, navigation label, and meta description.

Pages use one top-level path such as `/about/`. Built-in routes, the configured
Admin path, and previous Page paths are reserved. When a published Page slug
changes, microfeed keeps the old path and redirects it permanently to the new
one. Deleted Page paths also remain reserved so they cannot silently point at
unrelated content later. Enter the URL path explicitly; microfeed does not
derive it from the Page title.

The search and social description is plain text of up to 155 characters. It is
published in the Page's HTML `meta name="description"` tag; if left blank,
microfeed uses plain text extracted from the Page content.

Page visibility follows the familiar Published, Unlisted, and Draft model.
Published Pages may appear in theme navigation; Unlisted Pages have a public
URL but are omitted from navigation and public search.

Navigation is website-only theme data and does not add Pages to RSS or the
public JSON Feed. When **Show in navigation** is enabled, enter the navigation
label explicitly; it is not copied from the Page title. Return to the Pages
screen and drag Pages within **Website navigation** to choose their link order.
The drag handles also support Arrow Up and Arrow Down for keyboard ordering.

Every site also has a protected **Default 404 Page**. Edit its title,
description, and rich content like any other Page. Open `/404/` to preview it;
the preview and every missing public website URL render the same themed Page
with the correct `404` response.
The `/404/` path, Published visibility, navigation exclusion, and Page itself
are protected, so they cannot be changed or deleted. The 404 Page is also
omitted from public search, generated `llms.txt`, and generated `sitemap.xml`.

## Theme compatibility

Format v1 themes remain valid and continue rendering feed and item pages
unchanged. They do not expose Pages or public search. Admin allows Page drafts
under a v1 theme but requires an active format v2 theme before a Page can be
Published or Unlisted.

Format v2 adds two required slots:

| Slot | Context | Responsibility |
| --- | --- | --- |
| `webPage` | `page` and `navigation_pages` | Render one standalone Page, including the editable default 404 Page. `page.content_html` is trusted owner-authored rich text. |
| `webSearch` | `search` and `navigation_pages` | Render the dedicated `/search/` page and its search input/results container. |

The 404 uses the ordinary `webPage` slot, so existing format v2 themes work
without another template file. A theme can check `page.is_not_found_page` when
it wants distinct styling or structure for the 404 experience.

Older installed six-slot themes remain self-contained in D1 and continue to
render feed and item pages. The bundled Default theme is the current eight-slot
reference implementation for Pages and Search.

## Edit Site Files

Open **Site Files** in Admin. Every file has a private draft, a Draft or
Published visibility setting, a validated text content type, and a 256 KiB
template limit. Site Files use Mustache but never pass through the active theme,
so they work the same with format v1 and v2 themes.

The editor offers **Source** and **Preview** tabs. JSON, XML, RSS, Markdown,
YAML, CSS, and CSV templates use syntax highlighting; plain text uses a normal
text area. Preview renders the current unsaved source with live public data and
shows the exact response bytes instead of interpreting HTML or Markdown.

Templates receive JSON Feed fields at the top level, plus `pages`, `items`, and
`_site`. For example, use `{{title}}`, loop through
`{{#pages}}...{{/pages}}`, or reference `_site.json_feed_url`. Every Site File
receives up to 100 newest Published items and up to 100 most recently
updated Published Pages. The special 404 Page is excluded before the Page limit
is applied. Mustache escapes values by default; triple braces opt into unescaped
output.

microfeed creates three generated defaults:

- `robots.txt` advertises the generated sitemap. Offline or headless sites
  always return a crawler-wide disallow rule.
- `llms.txt` identifies microfeed and its documentation, summarizes the site,
  Published Pages, and recent Published items, and links to the instance API
  guide when API access and public API docs are enabled.
- `sitemap.xml` contains the home page, Published Pages, Published items, and
  supported image/video metadata.

Saving a generated file with Published visibility switches it to an override.
**Restore default file** returns it to the current microfeed default. Generated
files cannot be deleted, but they can be saved as Draft. Custom supported root
files can be created and deleted.

Saving with Published visibility validates both the Mustache source and its
rendered format. JSON and XML templates must render as valid JSON or XML.
microfeed also stores the last valid rendered result at publish time. If later
channel, Page, or item data would make an override invalid, the public route
logs the failure and serves that snapshot instead.

Successful Page, search, and Site File responses keep the standard public cache
policy: browsers revalidate while the edge may cache for five minutes and use
stale content for one day on origin errors. Site Files are invalidated after a
relevant channel, item, Page, or Site File change. Admin and API previews are
private and never cached; typeahead and 404 responses remain uncached.

## API and backups

Authenticated Page operations live under `/api/v1/pages/`. Site File draft,
publish, and reset operations live under `/api/v1/site-files/`. The generated
OpenAPI reference is the source of truth for request and response fields. Use
`POST /api/v1/site-files/preview/` to render unsaved template source without
publishing it.

Portable snapshots treat Pages, Page path history, Site File drafts, and
published overrides as durable data. The unified search corpus is derived and
is rebuilt during deployment or restore.
