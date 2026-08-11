# microfeed theme

This directory is a complete, versioned microfeed theme package. Coding agents
should edit only the six paths declared in `microfeed-theme.json`, declared
assets, and optional fixtures. Do not edit files under `.microfeed/schemas/`.
The bundled `develop-microfeed-theme` skill gives coding agents the same safe
workflow. Never create screenshots unless the owner explicitly requests them.

Install the repository-local authoring CLI once with `yarn install`. The
generated `package.json` keeps validation, tests, and preview reproducible for
people, coding agents, and CI.

## Edit and test loop

1. Read `microfeed-theme.json` and `.microfeed/schemas/theme-context.schema.json`.
2. Edit the six Mustache/XSL files. Mustache is logicless: variables, sections,
   inverted sections, and iteration only.
3. Run `yarn validate`.
4. Run `yarn test`.
5. Run `yarn preview` and inspect feed, item, RSS, mobile, and
   desktop views.
6. Increment the immutable semantic version before installation.

The render context is the public JSON Feed plus `current_year`,
`_theme.package_id`, `_theme.version`, and `_theme.asset_base_url`.
On item pages, use
`items.0`; the old `item` alias is deprecated. Theme code is trusted when
activated, so install only repositories you trust.

Declare every packaged asset in the manifest. For files under `assets/`,
reference them as `{{_theme.asset_base_url}}logo.png` (without repeating the
`assets/` directory). The preview server and an installed site resolve that
same URL to the packaged file.
