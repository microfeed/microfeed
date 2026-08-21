# Built-in microfeed themes

This directory contains the source packages registered in microfeed's ordered
Built-in theme catalog. D1 is the runtime source of truth after a package is
installed. The management CLI reads catalog packages from disk, verifies each
independent immutable release ledger, and synchronizes their current releases
during initialization and deployment.

`themes/default` remains the only package embedded in the Worker as the
emergency runtime fallback when no valid active version is available. Other
Built-in package contents are persisted in D1 by the management CLI and are not
added to the Worker bundle.

## `default`

`themes/default` is the format-v2 `microfeed.default@1.1.15` theme. New pristine
local, preview, and production instances install and activate it during
initialization. It includes the complete authoring workspace:

The `microfeed.*` package namespace is reserved for themes shipped from this
repository. Site-specific versions must fork to `local.*`; third-party theme
repositories must use a package ID controlled by their author.

- Tailwind CSS v4 and Vite build sources
- Vanilla TypeScript progressive enhancements
- Source templates, fixtures, schemas, and the theme-development skill
- The eight generated, installable theme files

Its deterministic build inlines compiled CSS and JavaScript into the eight-slot
bundle, so the installed theme does not require R2 or external runtime assets.
It renders feeds, items, standalone Pages, navigation, and the dedicated Search
page. microfeed supplies the public search dialog, typeahead behavior, and
Command/Ctrl-K handling through stable theme hooks.
Edit the sources under `themes/default/src/`, then regenerate and verify the
checked-in output:

```console
yarn workspace @microfeed/default-theme-source build
yarn workspace @microfeed/default-theme-source check
```

Before publishing changed installable files, increment the immutable version in
`microfeed-theme.json`, then record its canonical checksum:

```console
yarn theme:release
```

The release ledger is append-only. `yarn check` and `yarn manage deploy` reject
changed package bytes under an existing version before a site can be updated.

Installing it manually creates an inactive version and does not change the
public site:

```console
yarn manage theme install bundled:default --instance <instance-name>
```

## Working with the bundled theme

Fresh-instance initialization installs every current Built-in release and
activates only Default. Manual installation creates an inactive version, and
deployment never silently activates a different theme on an existing site.
Older themes that are already installed remain self-contained in D1; they do
not depend on a source folder in this repository.

Run the shared conformance suite after changing the package:

```console
yarn theme-kit:test
```

Bundled-theme fixtures must reference stable, direct HTTPS URLs for
royalty-free image, audio, and video examples. Prefer CC0 or public-domain
media, document its source and license in the theme's maintainer notes, and do
not check media binaries into a bundled theme.

For repository authoring, Admin drafts, packaged assets, and storage details,
read the [versioned themes guide](../docs/dashboard/themes.md).
