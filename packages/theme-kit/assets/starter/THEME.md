# microfeed theme

This directory is a complete, versioned microfeed theme package. Coding agents
should edit only the paths declared in `microfeed-theme.json`, declared
assets, and optional fixtures. Do not edit files under `.microfeed/schemas/`.
The bundled `develop-microfeed-theme` skill gives coding agents the same safe
workflow. Its [public-site reference](./.agents/skills/develop-microfeed-theme/references/public-site.md)
documents Pages, shared navigation, the search popup, the Search page, stable
hooks, styling tokens, and the platform/theme ownership boundary. Read it
before changing public layout or behavior. Never create screenshots unless the
owner explicitly requests them.

Claude Code reads `CLAUDE.md`, which directs it to that canonical bundled
skill on demand.

Install the repository-local authoring CLI once with `yarn install`. The
generated `package.json` keeps validation, tests, and preview reproducible for
people, coding agents, and CI.

## Edit and test loop

1. Read `microfeed-theme.json` and `.microfeed/schemas/theme-context.schema.json`.
2. Edit the declared Mustache/XSL files, including optional tag templates. Mustache is logicless:
   variables, sections, inverted sections, and iteration only.
3. Run `yarn validate`.
4. Run `yarn test`.
5. Run `yarn preview` and inspect feed, item, Page, Search, Tag page, All tags, RSS, mobile, and
   desktop views.
6. Increment the immutable semantic version before installation.

The render context is the public JSON Feed plus `current_year`,
`_theme.package_id`, `_theme.version`, and `_theme.asset_base_url`.
It also supplies the current `page`, ordered `navigation_pages`, and Search
page state when relevant; the generated context schema documents every field.
On item pages, use `items.0`; the old `item` alias is deprecated.

The optional `webTag` template renders `/tags/<slug>/` with the current tag
in `_microfeed.tag` and its published items. Without it, microfeed uses this
theme's `webFeed`. The optional `webTags` template renders `/tags/` with
`tags.items`, `tags.next_url`, `tags.rss_enabled`, and `tags.json_enabled`;
without it, microfeed uses the platform's All tags page. Declare each optional path
in `files` when supplying its template. Tag names and descriptions are plain
text; render them with escaped Mustache, never triple braces.

Every public HTML slot also receives `tag_navigation.items` (up to eight
tags) and `tag_navigation.url` (the All tags link). Use them to show a small
Browse tags section above the footer only on individual tag pages, guarded by
`_microfeed.tag`. Keep it hidden on other views and when there are no tags.
Show tag feed links between the tag name and description.
Show item tags on individual item pages, after subscription links when present,
outside other links, not on feed cards or in the top navigation. Keep any tag
icon decorative so the tag name remains the link's accessible label. Tag views
receive `site_title` for an item-style link back to the feed.

Keep shared navigation in Body start when it should render once across Feed,
Item, Page, and Search. Keep a shared footer and progressive enhancements in
Body end. microfeed injects and controls the public search dialog; themes add
visible `data-microfeed-search-open` triggers, provide the documented Search
page hooks, and style the interface without duplicating its Ajax or keyboard
controller.

Theme code is trusted when activated, so install only repositories you trust.

Keep the optional manifest `description` to 280 characters or fewer. Use it to
say what the theme is good for and which content types or layouts it supports.
Declare one `previewFixture` when representative demo content helps show those
capabilities; `yarn preview` uses that JSON fixture by default.

Declare every packaged asset in the manifest. For files under `assets/`,
reference them as `{{_theme.asset_base_url}}logo.png` (without repeating the
`assets/` directory). The preview server and an installed site resolve that
same URL to the packaged file.
