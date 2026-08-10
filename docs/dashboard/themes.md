---
title: Versioned themes
description: Author, install, customize, preview, publish, activate, and back up microfeed themes.
---

microfeed themes have six text slots: web feed, web item, web header, web body
start, web body end, and the complete RSS XSL stylesheet. A published version
is immutable. The active version lives in D1 with the other installed versions;
optional declared assets use immutable R2 keys.

Themes are full-trust, owner-installed code. An activated theme can run the same
HTML, CSS, and JavaScript as the existing custom-code feature. Install only
packages you trust.

## Customize in Admin

Open **Settings → Themes** and choose **Customize** for the built-in theme or
any installed version. This creates a separate, Admin-owned draft:

1. Edit any of the six slots and save repeatedly.
2. Preview feed, item, RSS, mobile, and desktop views with current public data.
3. Confirm or change the proposed semantic version.
4. Publish an immutable, inactive local version.
5. Preview the published version, then activate it separately.

Draft and inactive previews use authenticated, `no-store` routes inside an
iframe sandbox with scripts allowed but no same-origin access. Saving and
publishing do not change public output. Only **Activate** changes the live
selection. Activation confirmation identifies the package, version, origin,
commit when present, and checksum.

Admin editing never modifies an imported or active row. A customized imported
theme receives a `local.` package identity and records its origin. Upstream
updates can therefore be installed alongside the customized version. V1 drafts
inherit packaged assets and edit only the six text slots; add or replace assets
in the source repository and reinstall with `yarn manage theme`.

## Start a theme repository

The quickest way to preserve the look of an existing site is to initialize a
new repository from that instance's effective active theme:

```console
yarn manage theme init ./my-theme --instance <instance-name>
cd my-theme
npm install
npm test
```

The command chooses a valid active D1 theme, then the built-in default. It
copies the theme's six slots and declared assets, creates a separate
`local.my-theme@0.1.0` identity, and initializes Git on `main`. Separate
theme-agnostic globally shared header/body wrappers are not copied; they remain
site-shell customization. Use `--package-id`, `--name`, `--version`, and
`--author` to set the initial metadata, or `--no-git` if another tool owns Git
initialization.

## Upgrade from the old custom theme

On the first theme-aware request after upgrade, microfeed imports the selected
old custom theme once as the ordinary immutable version
`local.legacy-theme@1.0.0`, named **Legacy theme**. It becomes active only when
no D1 theme is already active. From that point onward it appears, previews,
customizes, activates, rolls back, exports, and deletes like every other
installed version; Admin has no separate legacy-theme controls.

The migration does not modify or delete `settings.customCode`. This preserves
the exact old data if the application itself must be rolled back to a release
that predates versioned themes. Current releases no longer render that retained
theme data as a fallback, and the old theme editor is no longer exposed.

To start from the generic default without reading a microfeed instance,
install the authoring kit in a separate repository and scaffold a package:

```console
npm install --save-dev @microfeed/theme-kit
npx microfeed-theme init .
```

The generated repository contains:

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

`THEME.md` is the coding-agent edit/test loop. The generated JSON Schemas are
the contract for the manifest and render context. The render context is the
public JSON Feed plus:

- `current_year`
- `_theme.package_id`
- `_theme.version`
- `_theme.asset_base_url`

The package root also exports the canonical Zod schemas, renderer, validator,
and inferred `ThemeManifestV1`, `ThemeContext`, `ThemeBundleV1`, `ThemeDraft`,
and `StoredThemeVersion` TypeScript types.

On item pages, use `items.0`. The `item` alias remains available only for
compatibility with existing themes. Mustache remains logicless: variables,
escaped/unescaped values, sections, inverted sections, and iteration.

Declare packaged files under `assets/` in the manifest, then reference them as
`{{_theme.asset_base_url}}logo.png` without repeating the `assets/` directory.
The standalone preview and installed site use the same URL convention.

## Validate, test, and preview

```console
microfeed-theme validate . --json
microfeed-theme test . --json
microfeed-theme preview .
microfeed-theme preview . --fixture media
microfeed-theme preview . --feed-url https://example.com/json/
microfeed-theme fixture pull https://example.com/json/ --output fixtures/site.json
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

V1 GitHub installation runs locally so a Worker request does not spend its
tight CPU budget downloading and validating a repository:

```console
yarn manage theme install https://github.com/owner/theme-repository \
  --instance <site>
yarn manage theme list --instance <site>
yarn manage theme activate <theme-id> --instance <site>
```

The installer accepts public repository, directory, and manifest URLs; resolves
the selected ref to an exact commit; fetches only the manifest and declared
files from allowlisted GitHub API/content hosts; and installs the result as
inactive. See the [canonical theme command reference](/manage-cli/#yarn-manage-theme)
for update, export, rollback, local/preview, and deletion behavior.

## Storage and backups

D1 stores immutable published versions, mutable drafts, and active/previous
state. R2 is optional for text-only themes. Local custom versions can share the
source version's asset owner without copying objects, and cleanup waits until no
published version or draft references that owner.

Portable snapshots include all three theme tables. A snapshot already archives
the complete R2 bucket, so installed versions, unpublished drafts, inherited
assets, migration state, and active/previous state restore together. The
selected old custom theme is copied into D1 without rewriting the retained
`settings.customCode` rollback data. Shared custom code continues to wrap an
installed theme.
