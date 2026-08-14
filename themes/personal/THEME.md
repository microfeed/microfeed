# Personal theme

This directory is a complete, versioned microfeed theme package
(`personal.minimal`). Coding agents should edit only the paths declared in
`microfeed-theme.json`, declared assets, and optional fixtures. Do not edit
files under `.microfeed/schemas/`. The bundled `develop-microfeed-theme` skill
gives coding agents the same safe workflow. Its
[public-site reference](./.agents/skills/develop-microfeed-theme/references/public-site.md)
documents Pages, shared navigation, the search popup, the Search page, stable
hooks, styling tokens, and the platform/theme ownership boundary. Read it
before changing public layout or behavior. Never create screenshots unless the
owner explicitly requests them.

## Design

- **Typography**: Georgia serif for body and headings; system sans-serif for
  the search control. Comfortable reading measure (42rem) and 1.7 line height.
- **Palette**: warm paper background, warm ink text, terracotta accent, using
  the `--mf-*` design tokens so Admin color changes apply.
- **Layout**: single column, generous whitespace, minimal chrome. Navigation
  and search live in the header; the footer carries only the copyright line.

## Edit and test loop

1. Read `microfeed-theme.json` and `.microfeed/schemas/theme-context.schema.json`.
2. Edit the eight declared Mustache/XSL files. Mustache is logicless:
   variables, sections, inverted sections, and iteration only.
3. Run `yarn validate`.
4. Run `yarn test`.
5. Run `yarn preview` and inspect feed, item, Page, Search, RSS, mobile, and
   desktop views.
6. Increment the immutable semantic version before installation.

The render context is the public JSON Feed plus `current_year`,
`_theme.package_id`, `_theme.version`, and `_theme.asset_base_url`. It also
supplies the current `page`, ordered `navigation_pages`, and Search page state
when relevant. Items expose `categories` (array of `{id, name, slug}`) and
`series` (`{id, kind, name, slug, series_number?}`) from the personal-site
features. On item pages, use `items.0`; the old `item` alias is deprecated.

The contact form renders on a Page whose slug is `contact` (the platform sets
`is_contact_page`). It POSTs `name`, `email`, and `message` to
`/contact/submit/`; the platform redirects back with `?sent=1` on success and
`?error=1` on validation failure.

Keep shared navigation in Body start when it should render once across Feed,
Item, Page, and Search. Keep a shared footer and progressive enhancements in
Body end. microfeed injects and controls the public search dialog; themes add
visible `data-microfeed-search-open` triggers, provide the documented Search
page hooks, and style the interface without duplicating its Ajax or keyboard
controller.

Theme code is trusted when activated, so install only repositories you trust.

Declare every packaged asset in the manifest. For files under `assets/`,
reference them as `{{_theme.asset_base_url}}logo.png` (without repeating the
`assets/` directory). The preview server and an installed site resolve that
same URL to the packaged file.
