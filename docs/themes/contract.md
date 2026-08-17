---
title: Theme contract and rendering
description: Understand the manifest, eight render slots, Mustache context, Pages, navigation, search hooks, schemas, fixtures, and package limits.
---

The generated schemas in each theme repository are the exact contract for its
manifest and render context. Read them before editing templates or generating
theme code.

## Format versions and slots

Format v1 themes have six slots and remain compatible with feed and item
pages. Format v2 adds standalone Pages and public Search, for eight slots total:

| Slot | Purpose |
| --- | --- |
| `webFeed` | Render the public feed home page. |
| `webItem` | Render one item page. |
| `webPage` | Render a standalone Page, including the editable default 404 Page. |
| `webSearch` | Render the complete `/search/` results page. |
| `webHeader` | Insert markup before `</head>`. |
| `webBodyStart` | Insert markup immediately after `<body>`. |
| `webBodyEnd` | Insert markup immediately before `</body>`. |
| `rssStylesheet` | Provide the complete RSS XSL stylesheet. |

An active format v1 theme prevents a Page from becoming Published or Unlisted.
It does not block Page drafts. Use format v2 for Pages, navigation, and public
search.

## Manifest and render context

`microfeed-theme.json` declares package identity, semantic version, compatible
microfeed versions, the theme file paths, and optional assets. One package ID
and version identifies one immutable set of content.

The render context begins with the public JSON Feed and adds:

- `current_year`;
- `_theme.package_id`;
- `_theme.version`;
- `_theme.asset_base_url`;
- `navigation_pages` on public HTML views;
- `page` on the Page slot; and
- `search` on the Search slot.

On item pages, use `items.0`. The `item` alias remains available only for
compatibility with older themes.

Mustache remains logicless: variables, escaped and unescaped values, sections,
inverted sections, and iteration are supported. Owner-authored rich HTML such
as item or Page `content_html` is intended for triple-brace rendering. Escape
ordinary text and attributes by default.

## Render Pages and navigation

`navigation_pages` contains Published Pages whose **Show in navigation**
setting is enabled, in the order selected in Admin. Draft, Unlisted, and the
special 404 Page are excluded. Navigation is website-only and never adds a
Page to RSS or JSON Feed.

Render the same navigation in feed, item, Page, and Search templates:

```html
<nav aria-label="Site navigation">
  {{#navigation_pages}}
    <a href="{{url}}">{{navigation_label}}</a>
  {{/navigation_pages}}
</nav>
```

The `webPage` slot also renders the protected default 404 Page. Check
`page.is_not_found_page` only when the theme needs distinct 404 styling; the
ordinary Page structure should otherwise work unchanged.

## Connect public search

microfeed injects one accessible search dialog into every public HTML page and
owns its keyboard handling, request cancellation, safe result rendering, and
typeahead behavior. Do not copy that dialog or script into the theme. Add
`data-microfeed-search-open` to a theme control that should open it:

```html
<button
  type="button"
  aria-haspopup="dialog"
  aria-controls="microfeed-search-dialog"
  data-microfeed-search-open
>
  Search
</button>
```

The `webSearch` slot owns the surrounding layout for `/search/`. Use
`search.query` and the stable input and results hooks:

```html
<form action="/search/" method="get" role="search">
  <label for="site-search">Search this site</label>
  <input
    id="site-search"
    name="q"
    type="search"
    value="{{search.query}}"
    data-microfeed-search-input
  >
  <button type="submit">Search</button>
  <div
    aria-live="polite"
    data-microfeed-search-results
    data-microfeed-search-details
  ></div>
</form>
```

The optional details hook adds a short date and excerpt to each result. The
dialog and results use stable `data-microfeed-search-*` hooks and
`mf-public-search*` classes for targeted styling.

Define `--mf-accent`, `--mf-background`, `--mf-surface`, `--mf-text`,
`--mf-muted`, and `--mf-border` color tokens so the injected dialog follows the
theme. Search preview uses representative results because live search is not
available inside the isolated preview.

## Schemas, fixtures, and package limits

A generated repository includes JSON Schemas under `.microfeed/schemas/`, a
representative package fixture, and built-in test fixtures for empty, minimal,
rich, paginated, media-heavy, missing-optional, multi-author, and hostile-rich-
HTML content.

Package limits are:

- 128 KiB per text slot;
- 512 KiB total theme text;
- 100 declared assets;
- 5 MiB per asset; and
- 20 MiB total assets.

Validation rejects absolute paths, traversal, symlinks, undeclared files,
malformed Mustache, invalid semantic versions, incompatible microfeed ranges,
and unsupported asset types. Tests check deterministic rendering, HTML
structure, and valid RSS XSL; themes are trusted code, so they do not sanitize
intentional HTML or JavaScript.

Continue with [Bundle CSS, JavaScript, and assets](/themes/assets/) or return to
[Build and release a theme](/themes/).
