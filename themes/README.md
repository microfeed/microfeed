# Bundled microfeed theme

This directory contains the one source package that ships with microfeed. D1
is the runtime source of truth after a theme is installed; `themes/default` is
the versioned, reviewable input used to create that installed copy and the
runtime fallback when no valid active version is available.

## `default`

`themes/default` is the format-v2 `microfeed.default@1.1.8` theme. New pristine
local, preview, and production instances install and activate it during
initialization. It includes the complete authoring workspace:

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

Installing it manually creates an inactive version and does not change the
public site:

```console
yarn manage theme install default --instance <instance-name>
```

## Working with the bundled theme

Fresh-instance initialization installs and activates the bundled default.
Manual installation creates an inactive version, and deployment never silently
activates a different theme on an existing site. Older themes that are already
installed remain self-contained in D1; they do not depend on a source folder in
this repository.

Run the shared conformance suite after changing the package:

```console
yarn theme-kit:test
```

For repository authoring, Admin drafts, packaged assets, and storage details,
read the [versioned themes guide](../docs/dashboard/themes.md).
