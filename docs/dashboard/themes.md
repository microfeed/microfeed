---
title: Themes and website code
description: Customize public pages with versioned themes and shared HTML, CSS, and JavaScript.
---

Open **Settings → Website appearance & code** to choose between two tools:

- **Manage versioned themes** controls the complete web feed, item page, public
  Page, search page, shared theme layout, and RSS stylesheet through immutable
  versions with isolated previews.
- **Edit shared HTML code across web pages** adds the same code around every
  active theme for tracking snippets, global branding, JavaScript, or CSS.

For a small visual change, you do not need to create a GitHub repository or
use a command line. Choose **Create new version** on the active theme, edit the
color values near the top of **Web header**, preview, save, install, and then
activate the new version.

## Choose the right tool

| Tool | Best for | How changes reach the live site |
| --- | --- | --- |
| Versioned theme | Page structure, visual design, responsive behavior, and RSS styling | Create and preview a draft, install an immutable version, then activate it separately. |
| Shared website code | Google Analytics, Meta Pixel, global CSS or JavaScript, navigation, branding, and footer snippets that should survive theme changes | Choose **Update** in the code editor; the saved code immediately wraps the active theme. |

## Edit shared website code

The shared code editor has three insertion points:

| Slot | Where it is inserted | Typical uses |
| --- | --- | --- |
| **Web Header** | Immediately before `</head>` | Analytics or pixel snippets, `<style>` blocks, metadata, and scripts that belong in the document head. |
| **Web Body Start** | Immediately after `<body>` | Shared navigation, announcements, or branding above the theme. |
| **Web Body End** | Immediately before `</body>` | Shared footer content, deferred scripts, or site-wide links. |

Shared code wraps every installed theme and is not part of a theme version.
Unlike a theme draft, it does not have an isolated preview or automatic version
history. Save the current code outside the dashboard before a large edit,
change one concern at a time, choose **Update**, and use **View live page** to
check feed, item, page, and search views at mobile and desktop widths.

Anything placed in shared code is sent to public browsers. Never include API
keys, Cloudflare tokens, dashboard credentials, private setup links, or other
secrets. Remove a snippet if it interferes with navigation, readability, feed
metadata, or the active theme.

## Work with versioned themes

A microfeed theme controls eight templates: feed, item, Page, Search, web
header, web body start, web body end, and the complete RSS XSL stylesheet. An
installed version is immutable. The active version lives in D1 with the other
installed versions; optional declared assets use immutable R2 keys.

Themes are full-trust, owner-installed code. An activated theme can run the same
HTML, CSS, and JavaScript as the shared website code feature. Install only
packages you trust.

### Render navigation items

The `navigation_pages` array contains Published Pages whose **Show in
navigation** setting is enabled, in the order chosen by dragging them on
**Pages → Website navigation**. Draft, Unlisted, and the special 404 Page are
not included. Navigation is website-only: it does not add those Pages to RSS or
the public JSON Feed.

Render the same navigation in the feed, item, Page, and Search templates so
visitors do not lose it as they move around the site:

```html
<nav aria-label="Site navigation">
  {{#navigation_pages}}
    <a href="{{url}}">{{navigation_label}}</a>
  {{/navigation_pages}}
</nav>
```

The theme owns responsive behavior and overflow. For example, the bundled
default keeps the first two links visible and moves additional Pages into its
**More** menu.

### Connect the search popup and Search page

microfeed injects one accessible search dialog into every public HTML page and
owns its keyboard handling, request cancellation, 150 ms typeahead debounce,
and safe result rendering. The system markup and script are appended at the end
of `<body>`, after shared and theme body-end markup. Do not copy the dialog or
its JavaScript into **Web body end**. Add `data-microfeed-search-open` to any
theme control that should open it:

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

Visitors can also open the dialog with <kbd>Command</kbd>+<kbd>K</kbd> on macOS
or <kbd>Ctrl</kbd>+<kbd>K</kbd> elsewhere. The dialog performs typeahead search;
submitting it opens `/search/?q=...` for the complete results page.

Public typeahead calls `/search.json` without exposing an API credential. It
returns only Published items and Published Pages, uses safe highlight segments,
and is never cached. Authenticated integrations use `GET /api/v1/search/`;
`types=items` remains the default, while `types=items,pages` searches both.

The **Search** template owns that page's surrounding layout. Use
`search.query` for its current value and provide the stable input and results
hooks so microfeed can render results. The optional
`data-microfeed-search-details` hook adds each result's short publication date
and two-line excerpt, including highlighted matched text:

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

The injected popup reads the theme's `--mf-accent`, `--mf-background`,
`--mf-surface`, `--mf-text`, `--mf-muted`, and `--mf-border` color tokens. Use
the same tokens on the Search page to keep both views aligned. A theme can add
more specific CSS through the stable
`data-microfeed-search-*` hooks and `mf-public-search*` classes. Search preview
uses embedded representative results and clearly warns that live search is
unavailable. See [Pages and Site Files](/dashboard/pages-search-and-site-files/)
for Page visibility and the content included in public search.

## Create a new version in Admin

Open **Settings → Themes**. Every selectable design appears as an installed
version. Search by name, package ID, version, author, or source URL; sort by
status, installation time, or name; and move through 20 results per page.
Choose **Create new version** on any row to create a separate editable draft
stored by your site:

1. Edit any of the theme's eight slots and save repeatedly.
2. Open the full-screen isolated preview for feed, item, page, search, RSS,
   mobile, and desktop views with current public data.
3. Confirm or change the proposed semantic version, such as `1.2.1`. This
   version number identifies the new immutable design.
4. Choose **Install** to create an immutable, inactive local version.
5. Preview the installed version, then activate it separately.

Draft and inactive previews use authenticated, `no-store` routes inside an
iframe sandbox with scripts allowed but no same-origin access. Saving and
installing do not change public output. Only **Activate** changes the live
selection. Activation confirmation identifies the package, version, origin,
commit when present, and checksum.

Admin editing never modifies an imported or active row. A derived imported
theme receives a `local.` package identity and records its origin. Upstream
updates can therefore be installed alongside the derived version. Dashboard
drafts inherit packaged assets and edit only the theme's text slots; add or
replace assets in the source repository and reinstall with `yarn manage theme`.

## Start a theme repository

The remaining sections are for theme authors and coding agents. Site owners who
only edit a version in Admin can skip to [Install and manage versions](#install-and-manage-versions).

The quickest way to begin is to initialize a standalone repository from the
theme your site is currently using. Keep it outside your microfeed checkout so
the new repository cannot be committed to microfeed accidentally:

```console
yarn manage theme init ~/microfeed-themes/my-theme --instance <instance-name>
cd ~/microfeed-themes/my-theme
yarn install
yarn validate
yarn test
```

You do not need to create `~/microfeed-themes/` first. The command creates any
missing parent directories and the `my-theme` directory, but refuses to write
into a non-empty destination. After it succeeds, the generated directory is an
independent Git repository on `main`.

The command chooses the site's effective theme, copies its available templates
and declared assets, and creates a separate `local.my-theme@0.1.0` identity. Use
`--package-id`, `--name`, `--version`, and `--author` to set publish-ready
metadata, or `--no-git` if another tool owns Git initialization.

Use `theme init` when you want to fork the site's effective appearance under a
new identity. Use `theme export` when an exact installed immutable version
already exists and its
package ID and version must be preserved as the development baseline.

This is a rendered-package export: it does not recreate private build tools or
source files used by the package author. The generated repository includes the
`develop-microfeed-theme` skill so a coding agent follows the manifest,
schemas, build scripts when present, validation, tests, and inactive-install
workflow. The skill never creates screenshots unless explicitly requested.

### Export an installed theme with an AI coding agent

Open the main microfeed checkout in a local coding agent. Replace the instance
and public feed URL in this prompt, then paste it into the agent. The CLI uses
the ignored `.microfeed/themes/<package-id>-<version>/` directory by default so
the standalone repository stays inside the same coding-agent workspace. Do not
use `dist/themes/`; application builds may replace that disposable output.

```text
Export an existing installed theme from the saved microfeed instance
<instance-name> into a verified standalone repository.

First run `yarn manage instances --json` and verify the exact saved instance.
Export its active installed immutable version with `yarn manage theme export
--active --instance <instance-name> --git --json`. Let the CLI use its default
`.microfeed/themes/<package-id>-<version>/` directory. If no installed version
is active, explain the `theme init` alternative and stop rather than changing
the package identity silently.

Do not activate, deactivate, install, delete, or otherwise change the live
site. In the exported directory, read README.md, THEME.md,
microfeed-theme.json, and the generated schemas. Run `yarn install`, `yarn
validate`, and `yarn test`, then start
`yarn preview --feed-url https://example.com/json/` and report the local preview
URL. Stop the preview server after verification.

After the baseline checks pass, show me `git status` and a proposed initial
commit message, then stop before staging, committing, pushing, creating a
GitHub repository, or opening a pull request.
```

The JSON result identifies the package ID, version, immutable theme ID,
selection method, output directory, and Git state. The result is a verified
local Git repository on `main`. The `--git` flag only
initializes it: export does not stage, commit, create a remote, push, install
the package, or change the active theme. The parent microfeed repository ignores
`.microfeed/`, but cleanup that removes ignored files can still delete this
local repository. Commit and push it from inside its own directory when you are
ready to preserve it elsewhere.

The generated repository pins Yarn 4, starts with an empty independent
`yarn.lock`, and requests the compatible `@microfeed/theme-kit` major range.
Its local Yarn configuration preapproves only that official toolkit, allowing
a freshly published toolkit release through Yarn's package-age gate without
weakening the gate for other dependencies. `yarn install` populates the
lockfile before validation.

Keep the first verified export unchanged until you review it. After making
theme edits, increment `microfeed-theme.json` SemVer, validate and test again,
install the new version as inactive, and preview it before separately approving
activation. Never reuse one package ID and version for different content.

### Develop with an AI coding agent

Open the generated directory in your coding agent and ask it to read
`THEME.md`, `microfeed-theme.json`, and the schemas under `.microfeed/schemas/`
before editing. A useful first request is:

> Build a responsive editorial theme from this starter. Keep the eight declared
> theme files valid, use the provided fixtures, run validation and tests, then
> preview the feed, item, page, search, and RSS views at desktop and mobile sizes.

The agent can edit Mustache, HTML, CSS, JavaScript, XSL, fixtures, and declared
assets without inspecting microfeed's application source. Its normal loop is:

1. Edit the declared theme files and any local build sources.
2. Build static assets.
3. Run `yarn validate` and `yarn test`.
4. Run `yarn preview` with the included fixtures.
5. Optionally preview real public content with
   `yarn preview --feed-url https://example.com/json/`.
6. Increment the semantic version before installation.

### Bundle CSS and JavaScript

A theme can use Vite, Webpack, Tailwind CSS, Sass, PostCSS, or other build-time
tools. microfeed never runs a theme repository's build scripts during
installation. Build locally, commit the generated package files, then run
validation and installation. Do not declare `src/`, build configuration,
`node_modules`, source maps, or other development-only files as theme assets.

The generated output can be stored in one of two ways:

| Output | Installed storage | R2 required? | Referenced from |
| --- | --- | --- | --- |
| CSS inside `<style>` and JavaScript inside `<script>` | The immutable theme bundle in D1 | No | `web-header.mustache` and `web-body-end.mustache` |
| Generated `.css` and `.js` files declared in `assets` | File bytes in R2; path, checksum, size, content type, and immutable owner recorded in D1 | Yes | `{{_theme.asset_base_url}}` |
| TypeScript, source CSS, Vite/Webpack configuration, and `node_modules` | Source repository only | No | Never loaded by the installed theme |

Inline output is convenient for a small, self-contained theme and remains
editable in an Admin version draft. It counts toward the 128 KiB per-slot and
512 KiB total text limits. Declared assets are better for larger bundles and
browser-cacheable files, but Admin drafts inherit them unchanged; rebuild
and install a new repository version to replace one.

#### Inline compiled output in D1

Use a build script to capture the bundler's output and place it in the rendered
theme files. With Vite, call its JavaScript API with `write: false`, find the
returned CSS asset and JavaScript entry chunk, then prepend or append them:

```js
const result = await build({
  build: {
    lib: {entry: "src/main.ts", formats: ["iife"], name: "MyTheme"},
    minify: true,
    write: false,
  },
});

// Read the CSS asset and JavaScript entry chunk from result.output.
// Write <style>…</style> into web-header.mustache and
// <script>…</script> into web-body-end.mustache.
```

Keep `assets: []` in `microfeed-theme.json`. The complete example is
`themes/default/scripts/build.mjs` in the microfeed repository. It compiles
Tailwind through `@tailwindcss/vite`, compiles vanilla TypeScript, escapes a
possible closing `</script>` sequence, and deterministically checks the eight
generated files. Once installed, the generated CSS and JavaScript are text in
the immutable D1 theme row; Vite and Tailwind are not runtime dependencies.

#### Emit packaged assets with Vite

For R2-backed bundles, import the CSS from the JavaScript entry and emit stable
filenames under `assets/`:

```console
npm install --save-dev vite typescript
```

```ts
// vite.config.ts
import {resolve} from "node:path";
import {defineConfig} from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/main.ts"),
      formats: ["iife"],
      name: "MyMicrofeedTheme",
      fileName: () => "theme.js",
      cssFileName: "theme",
    },
    minify: true,
    outDir: "assets",
  },
});
```

`src/main.ts` can import `./theme.css`. To compile Tailwind v4 in the same
build, install `tailwindcss` and `@tailwindcss/vite`, import the plugin, and add
`plugins: [tailwindcss()]` to the Vite configuration.

#### Emit packaged assets with Webpack

Webpack can produce the same two deterministic files:

```console
npm install --save-dev webpack webpack-cli typescript ts-loader css-loader mini-css-extract-plugin
```

```js
// webpack.config.cjs
const path = require("node:path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  mode: "production",
  entry: "./src/main.ts",
  output: {
    clean: true,
    filename: "theme.js",
    path: path.resolve(__dirname, "assets"),
  },
  module: {rules: [
    {test: /\.ts$/, exclude: /node_modules/, use: "ts-loader"},
    {test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"]},
  ]},
  plugins: [new MiniCssExtractPlugin({filename: "theme.css"})],
  resolve: {extensions: [".ts", ".js"]},
};
```

#### Declare and load packaged bundles

For either bundler, declare every generated runtime file:

```json
{
  "assets": ["assets/theme.css", "assets/theme.js"]
}
```

Load the files from the theme slots without repeating the `assets/` directory:

```html
<!-- web-header.mustache -->
<link rel="stylesheet" href="{{_theme.asset_base_url}}theme.css">

<!-- web-body-end.mustache -->
<script src="{{_theme.asset_base_url}}theme.js" defer></script>
```

The preview server makes that base URL point to its local `/assets/` handler.
During installation, the management CLI validates the generated files, uploads
their bytes to immutable R2 keys shaped like
`<environment>/themes/<asset-owner-theme-id>/assets/<relative-file>`, verifies the
uploads, then writes the normalized manifest, theme text slots, and asset
metadata to D1. The live `_theme.asset_base_url` points through microfeed's
public `/media/` route to those same objects. The Worker never contacts GitHub
or invokes Vite or Webpack while rendering a page.

Enable R2 before installing a theme with declared assets:

```console
yarn manage deploy --enable-r2 --instance <instance-name>
```

Add `--local` when enabling the simulated media store for a local-only site.
External HTTPS bundles can also be linked directly and are not stored by
microfeed, but packaged or inline output makes versions and previews
reproducible.

### Start from microfeed's bundled default source

The complete source project for the bundled default lives at `themes/default`
in the microfeed repository. It uses Tailwind CSS v4 through
`@tailwindcss/vite`, Vite's programmatic `write: false` output, and vanilla
TypeScript. Its deterministic build places minified CSS in
`web-header.mustache` and JavaScript in `web-body-end.mustache`; `assets` stays
empty, so the installed package works when R2 is disabled.

The default uses a clean, responsive layout and typography. Its page shell uses
normal document flow: the footer reaches the bottom of the
viewport when a page is short or empty, while longer content pushes the footer
down instead of being covered by a fixed element.

Copy or clone that directory into a standalone repository when you want the
full build toolchain. Run its build script after editing `src/theme.css`,
`src/main.ts`, or source templates. The checked-in eight-slot files are the
installable result.

The top of the default theme’s generated **Web header** contains a readable
`microfeed-design-tokens` block. In Admin, follow **Create new version** → edit
the token values → **Preview** → **Save draft** → **Install** → **Activate** to
change accent, background, surface, text, muted, and border colors without
working through the compiled Tailwind CSS.

### Start from the generic starter

To start from a visually simple generic package without reading a microfeed instance,
run the published authoring kit with a destination outside your microfeed
checkout:

```console
yarn dlx @microfeed/theme-kit init ~/microfeed-themes/my-theme
cd ~/microfeed-themes/my-theme
yarn install
yarn validate
yarn test
yarn preview
```

The scaffold includes a local `package.json`, empty `yarn.lock`, and Yarn
configuration, so people, coding agents, and CI all use the same independent
CLI and scripts. It preapproves only the official `@microfeed/theme-kit`
package while retaining Yarn package gates for every other dependency.
Initialize Git after reviewing the files. The compatible
`@microfeed/theme-kit` major range follows the microfeed application release;
the new theme starts at its own independent `0.1.0` manifest version.

### Understand the generated contract

The generated repository contains:

```text
package.json
.gitignore
.yarnrc.yml
yarn.lock
microfeed-theme.json
THEME.md
web-feed.mustache
web-item.mustache
web-page.mustache
web-search.mustache
web-header.mustache
web-body-start.mustache
web-body-end.mustache
rss-stylesheet.xsl
assets/
fixtures/
.microfeed/schemas/
.agents/skills/develop-microfeed-theme/
```

`THEME.md` is the coding-agent edit/test loop. The generated JSON Schemas are
the contract for the manifest and render context. The render context is the
public JSON Feed plus:

- `current_year`
- `_theme.package_id`
- `_theme.version`
- `_theme.asset_base_url`

The package root also exports the canonical Zod schemas, renderer, validator,
and inferred manifest, context, bundle, draft, and stored-version TypeScript
types.

On item pages, use `items.0`. The `item` alias remains available only for
compatibility with existing themes. Mustache remains logicless: variables,
escaped/unescaped values, sections, inverted sections, and iteration.

Declare packaged files under `assets/` in the manifest, then reference them as
`{{_theme.asset_base_url}}logo.png` without repeating the `assets/` directory.
The standalone preview and installed site use the same URL convention.

## Validate, test, and preview

The common commands are below. See the
[complete theme-kit CLI reference](/theme-kit-cli/) for every
option, default, output format, and failure behavior.

```console
yarn validate
yarn test
yarn preview
yarn preview --fixture media
yarn preview --feed-url https://example.com/json/
yarn theme-kit fixture pull https://example.com/json/ --output fixtures/site.json
```

The test suite covers empty and minimal feeds, long and rich content,
pagination, audio, video, images, documents, external links, missing optional
fields, multiple authors and subscription methods, and potentially hostile rich
HTML. Themes are trusted code, so tests check deterministic rendering and
valid XSL rather than sanitizing intentional output.

Package limits are 128 KiB per text slot, 512 KiB total text, 100 declared
assets, 5 MiB per asset, and 20 MiB total assets. PNG, JPEG, GIF, WebP, AVIF,
SVG, ICO, WOFF/WOFF2, CSS, JavaScript, and JSON assets are accepted. Absolute
paths, traversal, symlinks, undeclared assets, malformed Mustache, incompatible
microfeed ranges, and invalid semantic versions are rejected.

## Install and manage versions

GitHub theme installation runs locally so a Worker request does not spend its
tight CPU budget downloading and validating a repository:

```console
yarn manage theme install https://github.com/owner/theme-repository \
  --instance <instance-name>
yarn manage theme list --instance <instance-name>
yarn manage theme activate <theme-id> --instance <instance-name>
```

The installer accepts public repository, directory, and manifest URLs; resolves
the selected ref to an exact commit; fetches only the manifest and declared
files from allowlisted GitHub API/content hosts; and installs the result as
inactive. See the [canonical theme command reference](/manage-cli/#yarn-manage-theme)
for update, export, rollback, local/preview, and deletion behavior.

Use `theme update` when an installed version still points to a bundled, local,
or GitHub source that can provide a newer release. Use `theme export` for an
Admin-derived version or another installation without an updateable source.
Export preserves the installed package ID and version and writes its templates,
inherited assets, README, package scripts, fixture, schemas, and agent skill to
an empty standalone directory. Pass `--git` to initialize the result as a local
Git repository on `main`; without that flag, it remains only Git-ready. Export
does not stage, commit, create a remote, push, install, activate, or otherwise
change the public site.

An environment can hold 50 non-deleted installed versions and 20 drafts.
Deleted inactive versions do not count toward the installed limit. If an Admin
draft cannot be installed because the limit is full, it remains saved so the
owner can delete an inactive version and try again.

Install the bundled modern default manually from any current microfeed clone:

```console
yarn manage theme install default --instance <instance-name>
```

The manual install is inactive. Fresh local, production, and preview instances
install and activate it during initialization. Upgrades preserve the site's
current active selection. Installing or updating microfeed never silently
activates a different theme; activate a newly installed version only after you
preview and approve it.

## Storage and backups

D1 stores immutable installed versions, mutable drafts, and active/previous
state. R2 is optional for text-only themes. Local custom versions can share the
source version's asset owner without copying objects, and cleanup waits until no
installed version or draft references that owner.

Portable snapshots include all three theme tables. A snapshot already archives
the complete R2 bucket, so installed versions, unpublished drafts, inherited
assets, migration state, and active/previous state restore together.

`themes/default` is the only bundled source package in the microfeed checkout.
Once installed, its normalized manifest and theme bundle live in D1 exactly
like community themes. Listing pages and
`theme list` read metadata-only projections; full bundle rows are loaded only
for preview, editing, export, validation, update, activation, or cleanup.
