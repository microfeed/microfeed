---
title: Pages, search, and Site Files
description: Publish standalone Pages, enable public search, and customize root-level text files.
---

microfeed separates website-only content from feed items. Use **Pages** for
documents such as About, Contact, or Resources. Use **Site Files** for raw
root-level text such as `robots.txt`, `llms.txt`, `sitemap.xml`, or a custom
`security.txt`.

## Create a Page

Open **Pages → Add Page** in Admin. The editor deliberately resembles the item
editor: it has the same visual/HTML content editor, plus website-specific
controls for the URL path, visibility, navigation label, navigation order, and
meta description.

Pages use one top-level path such as `/about/`. Built-in routes, the configured
Admin path, and previous Page paths are reserved. When a published Page slug
changes, microfeed keeps the old path and redirects it permanently to the new
one. Deleted Page paths also remain reserved so they cannot silently point at
unrelated content later.

Page visibility follows the familiar Published, Unlisted, and Draft model.
Published Pages may appear in theme navigation; Unlisted Pages have a public
URL but are omitted from navigation and public search.

## Theme compatibility

Format v1 themes remain valid and continue rendering feed and item pages
unchanged. They do not expose Pages or public search. Admin allows Page drafts
under a v1 theme but requires an active format v2 theme before a Page can be
Published or Unlisted.

Format v2 adds two required slots:

| Slot | Context | Responsibility |
| --- | --- | --- |
| `webPage` | `page` and `navigation_pages` | Render one standalone Page. `page.content_html` is trusted owner-authored rich text. |
| `webSearch` | `search` and `navigation_pages` | Render the dedicated `/search/` page and its search input/results container. |

The original six slots remain unchanged. The bundled Classic theme stays at
format v1 for exact appearance compatibility; the bundled Default theme is a
format v2 reference implementation.

## Public search

With a format v2 theme active, visitors can open search from a theme control or
press Command-K on macOS and Ctrl-K elsewhere. microfeed owns the accessible
dialog, keyboard behavior, request cancellation, 150 ms typeahead debounce,
and safe result DOM. The theme owns the dedicated `webSearch` layout and may
style the stable `data-microfeed-search-*` hooks and `mf-public-search*`
classes.

The system script is appended at the end of `<body>`, after shared and theme
body-end markup. Theme authors should add `data-microfeed-search-open` to any
button that opens the dialog, and use `data-microfeed-search-input` with a
nearby `data-microfeed-search-results` container on the Search page.

Public typeahead calls `/search.json` without exposing an API credential. It
returns only Published items and Published Pages, uses safe highlight segments,
and is never cached. Authenticated integrations use `GET /api/v1/search/`;
`types=items` remains the default, while `types=items,pages` searches both.

## Edit Site Files

Open **Site Files** in Admin. Every file has a private draft, an explicit
Publish action, an Enabled switch, a validated text content type, and a 256 KiB
limit. Site Files never pass through Mustache or the active theme.

microfeed creates three generated defaults:

- `robots.txt` advertises the generated sitemap. Offline or headless sites
  always return a crawler-wide disallow rule.
- `llms.txt` summarizes the site, Published Pages, and recent Published items.
- `sitemap.xml` contains the home page, Published Pages, Published items, and
  supported image/video metadata.

Editing and publishing a generated file switches it to an override. **Restore
generated** returns it to the current microfeed default. Generated files cannot
be deleted, but they can be disabled. Custom supported root files can be
created and deleted.

## API and backups

Authenticated Page operations live under `/api/v1/pages/`. Site File draft,
publish, and reset operations live under `/api/v1/site-files/`. The generated
OpenAPI reference is the source of truth for request and response fields.

Portable snapshots treat Pages, Page path history, Site File drafts, and
published overrides as durable data. The unified search corpus is derived and
is rebuilt during deployment or restore.
