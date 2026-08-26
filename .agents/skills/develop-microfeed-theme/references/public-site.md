# Public Pages, navigation, and search

Read this reference before changing a theme's public shell, Page template,
navigation, or search experience.

Public Pages and search require format v2. When an exported theme is format v1,
preserve its package ID, increment its immutable version, set
`formatVersion` to `2`, add the `webPage` and `webSearch` manifest paths
and templates, then follow this contract. Keep the six existing slots while
adding those two; validate and preview every view before installation.

## Theme and platform responsibilities

A format v2 theme owns:

- Feed, Item, Page, and Search page structure and presentation.
- Shared markup immediately after `<body>` and before `</body>`.
- The RSS browser stylesheet.
- Visible search triggers, Search page markup, and responsive Page navigation.
- CSS that customizes the platform-provided search interface.
- The optional manifest choice for item search-result destinations.

microfeed owns:

- Page visibility, public routing, the editable 404 fallback, and navigation
  filtering and ordering.
- The public search endpoint, popup dialog, Command/Ctrl+K behavior, typeahead
  debounce and cancellation, safe highlighting, result rendering, and
  destination fallback behavior.
- Injecting the search dialog and its script after the theme's Body end slot.

Do not copy the search dialog, call `/search.json` yourself, or implement
another typeahead controller in theme JavaScript. Change the main microfeed
application—not a theme—when the requested work changes search behavior,
query semantics, Page visibility, or navigation data.

## Eight theme slots

| Manifest key | Responsibility |
| --- | --- |
| `webFeed` | Feed index and pagination content |
| `webItem` | One Item page |
| `webPage` | One standalone Page, including the special 404 Page |
| `webSearch` | Dedicated `/search/` page |
| `webHeader` | Shared `<head>` metadata, CSS, and optional scripts |
| `webBodyStart` | Shared public shell immediately after `<body>` |
| `webBodyEnd` | Shared footer or scripts immediately before platform additions |
| `rssStylesheet` | Complete XSL stylesheet for browser-rendered RSS |

Put site-wide navigation in Body start when it should appear once on Feed,
Item, Page, and Search. Put a shared footer and compiled progressive
enhancements in Body end. Keep each page template focused on its `<main>`
content. Body start and Body end receive the same common Mustache context as
the page templates.

## Pages and navigation

The Page template receives `page`. Render trusted Page HTML with triple
Mustache and provide a text fallback when useful:

```html
<main>
  {{#page}}
  <article>
    <h1>{{title}}</h1>
    <div>{{{content_html}}}</div>
  </article>
  {{/page}}
</main>
```

The schema documents all Page fields, including dates, metadata, status,
navigation settings, and `is_not_found_page`. The special 404 Page can be
previewed at `/404/` and is also rendered for real missing URLs.

Every public HTML slot receives the ordered `navigation_pages` array. It
contains only Published Pages with **Show in navigation** enabled, in the order
chosen in Admin. Draft and Unlisted Pages and the special 404 Page are
excluded. Navigation is website-only; it does not add Pages to RSS or JSON
Feed.

Render links from the supplied URL and label:

```html
<nav aria-label="Site navigation">
  {{#navigation_pages}}
  <a href="{{url}}" data-microfeed-nav-item>{{navigation_label}}</a>
  {{/navigation_pages}}
</nav>
```

The theme owns mobile behavior and overflow. Test with at least three entries
so an overflow menu is exercised. Do not sort the array again or infer Page
visibility in theme code.

## Search popup

microfeed injects one accessible dialog into every format v2 public HTML page.
Add `data-microfeed-search-open` to each visible control that should open it:

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

A desktop search-looking control may be readonly and use the same hook; the
actual typeahead input belongs to the popup. Command+K on macOS and Ctrl+K on
other platforms work without theme JavaScript.

## Dedicated Search page

The Search template receives `search.query`. Live results are rendered safely
into the stable hooks by microfeed. Use a normal GET form so search still has a
clear URL and submission behavior:

```html
<form action="/search/" method="get" role="search" data-microfeed-search-scope>
  <label for="site-search">Search this site</label>
  <input
    id="site-search"
    name="q"
    type="search"
    value="{{search.query}}"
    autocomplete="off"
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

`data-microfeed-search-details` opts into a short publication date and a
two-line excerpt with safe matched-text highlighting. Omit it only when the
design intentionally needs title-only results.

Standalone and Admin previews use representative item and Page results. They
display a warning because live Ajax search is deliberately disabled in preview.
The Search page template and popup remain fully styleable there.

## Search result destinations

Set the optional format v2 manifest field `searchItemDestination` to choose
where Item results open in both the popup and the dedicated Search page:

- `web` opens the local microfeed Item page from JSON Feed
  `items[]._microfeed.web_url`. RSS uses this as `<item><link>` only when Item
  URL is empty. This is the default when omitted.
- `url` opens JSON Feed `items[].url`, the same value used for RSS
  `<item><link>`, when present.
- `attachment` opens the media attachment at JSON Feed
  `items[].attachments[0].url`, the same value used for RSS
  `<item><enclosure url="…">`, when present.

The `url` and `attachment` choices fall back to the local Item page when the
selected value is missing. Page results always open their local Page URL.
microfeed normalizes local media paths and keeps attachment analytics tracking;
themes should render the supplied result link without rebuilding it.

## Search styling

Define these tokens in the Web header to align the injected popup with the
theme:

```css
:root {
  --mf-accent: #0969da;
  --mf-background: #ffffff;
  --mf-surface: #f6f8fa;
  --mf-text: #1f2328;
  --mf-muted: #57606a;
  --mf-border: #d0d7de;
}
```

Prefer the tokens for broad design changes. For targeted rules, use the stable
`data-microfeed-search-*` hooks and these public classes:

- `.mf-public-search`
- `.mf-public-search__panel`, `__header`, `__close`, `__input-row`, and
  `__results`
- `.mf-public-search-result`, `__title`, `__type`, `__domain`, and `__details`

The results container receives
`data-microfeed-search-results-context="popup|page"`, and each result link
receives `data-microfeed-search-result-type="item|page"`. Use those attributes
to style the popup and Search page differently or to target only Items.

The domain element contains the resolved link destination's hostname, including
subdomains, and is hidden by default. Opt in with the inherited display token:

```css
[data-microfeed-search-result-type="item"] {
  --mf-search-result-domain-display: inline;
}

[data-microfeed-search-results-context="popup"] .mf-public-search-result {
  padding: 0.6rem;
}

[data-microfeed-search-results-context="page"] .mf-public-search-result {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.mf-public-search-result__domain {
  color: var(--mf-muted);
}
```

microfeed creates the link and every text node safely. Restyle or hide the
documented parts; do not replace result rendering with theme JavaScript or
reconstruct result HTML.

Keep focus styles, labels, keyboard behavior, mobile layout, and reduced-motion
preferences accessible.

## Preview checklist

Use the bundled fixtures first, then run `yarn preview` and verify:

- Feed, Item, Page, Search, and RSS views.
- Desktop and mobile widths.
- Exactly one shared navigation and footer.
- Zero, one, two, and three-or-more navigation entries.
- Search controls open the popup by click and Command/Ctrl+K.
- Search preview results include both an Item and a Page.
- The Search page form, excerpts, highlighting, empty state, and long text.
- The special 404 Page layout and short-page footer placement.

If build sources exist, edit them and regenerate declared outputs. An exported
repository may contain only the rendered installable files; in that case,
preserve the exact baseline, edit those declared files directly, and increment
the immutable theme version before installation.
