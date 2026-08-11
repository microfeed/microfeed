# `@microfeed/theme-kit`

[Package on npm](https://www.npmjs.com/package/@microfeed/theme-kit) ·
[Theme guide](https://docs.microfeed.org/dashboard/themes/) ·
[Source repository](https://github.com/microfeed/microfeed/tree/main/packages/theme-kit)

The official, agent-friendly toolkit for creating, validating, testing, and
previewing versioned [microfeed](https://www.microfeed.org/) themes without
reading microfeed application internals. It provides the `microfeed-theme`
command and exports the same schemas, types, renderer, and validator used by
the microfeed Worker and Admin previews.

`@microfeed/theme-kit` is for theme source repositories. It does not deploy a
microfeed site or change an active theme:

| Tool | Purpose |
| --- | --- |
| `microfeed-theme` from `@microfeed/theme-kit` | Develop and preview a theme package locally |
| `yarn manage theme …` from a microfeed checkout | Export an instance theme; install, update, activate, or delete versions |
| `microfeed` from `@microfeed/cli` | Publish and manage feed content through the public API |

## Requirements

- Node.js 22.12 or newer
- Yarn 4 for the examples below; npm and pnpm can run the same package
- A modern browser for the local preview
- R2 on the target microfeed instance only when the theme declares packaged assets

## Start a standalone theme repository

Keep theme repositories outside the microfeed checkout so generated files are
not accidentally committed to the application repository.

### Start from your site’s current theme

This is the recommended path when you already have a microfeed instance. Run
the command from a microfeed checkout. It exports the effective active theme,
declared assets, schemas, fixtures, local scripts, and agent skill, then starts
an independent Git repository:

```console
yarn manage theme init ~/microfeed-themes/my-theme \
  --instance <instance-name>
cd ~/microfeed-themes/my-theme
yarn install
yarn validate
yarn test
yarn preview
```

You do not need to create `~/microfeed-themes/` first. The command creates
missing parents and refuses to overwrite a non-empty destination.

### Start from the generic starter

Use the published theme kit when you do not need an existing site’s design:

```console
yarn dlx @microfeed/theme-kit init ~/microfeed-themes/my-theme
cd ~/microfeed-themes/my-theme
yarn install
git init --initial-branch main
yarn validate
yarn test
yarn preview
```

The generic starter is intentionally simple. To start with Tailwind CSS, Vite,
and vanilla TypeScript build sources, copy the
[`themes/default`](https://github.com/microfeed/microfeed/tree/main/themes/default)
workspace from the microfeed repository into its own repository.

## How a theme works

A theme is a directory with `microfeed-theme.json` and six required text files:

```text
microfeed-theme.json
THEME.md
web-feed.mustache
web-item.mustache
web-header.mustache
web-body-start.mustache
web-body-end.mustache
rss-stylesheet.xsl
assets/
fixtures/
.microfeed/schemas/
```

The slots have distinct jobs:

| Slot | Rendered output |
| --- | --- |
| Web feed | The public feed index and pagination |
| Web item | A single item page |
| Web header | Shared `<head>` markup, styles, metadata, and optional scripts |
| Web body start | Shared markup immediately after `<body>` |
| Web body end | Shared markup immediately before `</body>` |
| RSS stylesheet | The complete XSL stylesheet used when a browser opens the RSS feed |

Web files use logicless Mustache: escaped and unescaped variables, sections,
inverted sections, and list iteration. The render context is the public JSON
Feed plus `current_year`, `_theme.package_id`, `_theme.version`, and
`_theme.asset_base_url`. The generated
`.microfeed/schemas/theme-context.schema.json` documents every field and
optional value. On item pages, use `items.0`; the older `item` alias exists only
for compatibility.

`THEME.md` is the package-local contract for a person or coding agent. The
generated `develop-microfeed-theme` skill teaches agents to read the manifest
and schemas, preserve build sources, validate every change, bump SemVer, and
avoid activation or screenshots without explicit permission.

## Where code and assets are stored

Installation never runs repository build scripts. Build and commit every
runtime file before installing a version.

- The normalized manifest and six text slots are stored together in one
  immutable D1 theme row.
- Small compiled CSS can be placed in `<style>` in `web-header.mustache`, and
  small compiled JavaScript can be placed in `<script>` in
  `web-body-end.mustache`. This needs no R2.
- Files declared in the manifest’s `assets` array are uploaded to immutable R2
  keys. Templates reference them through `{{_theme.asset_base_url}}` rather
  than a bucket hostname or hard-coded `/media/` path.
- TypeScript, source CSS, Vite or Webpack configuration, source maps, and
  `node_modules` remain in the theme repository. They are not installed or
  served by microfeed.

The preview server maps `_theme.asset_base_url` to its local `/assets/`
handler. An installed site maps the same references through microfeed’s public
media route. This keeps one package portable across local, preview, and
production environments.

Themes are full-trust, owner-installed code when activated. Install only a
repository and version you trust. Local and Admin previews run in an isolated
iframe, but activation intentionally has the same capabilities as other
owner-authored site code.

## Bundle CSS and JavaScript

Vite, Webpack, Tailwind CSS, Sass, and PostCSS are build-time choices rather
than theme runtime dependencies. A typical Vite build either:

1. uses `write: false`, captures the compiled CSS and JavaScript, and writes
   them inside `web-header.mustache` and `web-body-end.mustache`; or
2. emits deterministic files such as `assets/theme.css` and
   `assets/theme.js`, which are declared in `microfeed-theme.json` and loaded
   from `_theme.asset_base_url`.

Use the first approach for a small self-contained theme that must work without
R2. Use declared assets for larger, independently cacheable bundles. See the
[complete Vite, Webpack, Tailwind, D1, and R2 examples](https://docs.microfeed.org/dashboard/themes/#bundle-css-and-javascript).

## Normal development workflow

1. Read `THEME.md`, `microfeed-theme.json`, and both generated schemas.
2. If the repository has source templates, TypeScript, or source CSS, edit
   those sources and run its build. Do not hand-edit generated outputs.
3. Run `yarn validate` to check the manifest, compatibility, declared paths,
   file types, sizes, Mustache, XSL, and assets.
4. Run `yarn test` to render the built-in and repository fixtures, check
   deterministic output, parse HTML, and validate rendered XML.
5. Run `yarn preview`. Inspect feed, item, and RSS output at mobile and desktop
   widths. Optionally pull or preview a public JSON Feed.
6. Increment the manifest’s semantic version. The same package ID and version
   can never identify different content.
7. Commit the source and generated runtime files, then push the standalone
   repository to GitHub.
8. From a microfeed checkout, install the exact repository version as inactive:

   ```console
   yarn manage theme install https://github.com/owner/my-theme \
     --instance <instance-name>
   ```

9. Preview the installed version in **Settings → Themes**, then activate it as
   a separate, confirmed action.

Saving, installing, exporting, testing, and previewing never activate a theme.

## Command reference

Every command supports contextual help:

```console
yarn microfeed-theme --help
yarn microfeed-theme validate --help
yarn microfeed-theme --version
```

### `init`

```console
microfeed-theme init <directory>
```

Creates the generic theme package, local scripts, schemas, fixtures, and agent
skill. Missing parent directories are created; a non-empty destination is
rejected.

### `validate`

```console
microfeed-theme validate <directory> [--json]
```

Validates the complete installable package. JSON output is suitable for coding
agents and CI.

### `test`

```console
microfeed-theme test <directory> [--json]
```

Runs built-in fixtures for empty, minimal, rich, paginated, media, missing-field,
multi-author, subscription, and hostile-rich-HTML cases, followed by fixtures
under the package’s `fixtures/` directory.

### `preview`

```console
microfeed-theme preview <directory> \
  [--fixture <name-or-file> | --feed-url <url>]
```

Starts an isolated local server with feed, item, RSS, mobile, and desktop views.
It uses the production renderer and serves declared assets locally.

### `fixture pull`

```console
microfeed-theme fixture pull <json-feed-url> --output <file>
```

Downloads and validates a public JSON Feed without contacting an Admin API.
The command refuses to replace an existing file. Review copied content before
committing it.

## Use the library API

The package root exports the canonical Zod contracts, inferred TypeScript
types, runtime-neutral renderer, and validator:

```ts
import {
  renderThemeTemplate,
  themeContextSchema,
  themeManifestV1Schema,
  validateThemePackage,
  type ThemeBundleV1,
  type ThemeContext,
  type ThemeManifestV1,
} from "@microfeed/theme-kit";
```

The package and `@microfeed/cli` use the same release number as the root
microfeed application so compatible tooling can be identified from one
release. Theme package versions such as `example.my-theme@2.1.0` are separate:
they describe immutable design releases and do not need to match microfeed.

## Bugs and license

- [Report a bug](https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug)
- [Read the complete theme guide](https://docs.microfeed.org/dashboard/themes/)

`@microfeed/theme-kit` is licensed under the
[GNU Affero General Public License v3.0](./LICENSE), the same license as
microfeed.
