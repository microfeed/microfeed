# Bundled microfeed themes

This directory contains the source packages that ship with microfeed. D1 is
the runtime source of truth after a theme is installed; these folders are the
versioned, reviewable inputs used to create those installed copies.

## `default`

`themes/default` is the modern `microfeed.default@1.0.0` theme. New pristine
local, preview, and production instances install and activate it during
initialization. It includes the complete authoring workspace:

- Tailwind CSS v4 and Vite build sources
- Vanilla TypeScript progressive enhancements
- Source templates, fixtures, schemas, and the theme-development skill
- The six generated, installable theme files

Its deterministic build inlines compiled CSS and JavaScript into the six-slot
bundle, so the installed theme does not require R2 or external runtime assets.
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

## `classic`

`themes/classic` is the frozen `microfeed.classic@1.0.0` rendering of the
pre-versioned microfeed design. It exists to preserve the appearance of
upgraded sites and as the emergency fallback selected by theme deactivation or
an invalid active theme.

Classic is intentionally a rendered six-file package rather than a modern
build workspace. Avoid restyling it in place. A deliberate compatibility fix
should be reviewed as fallback behavior and released as a new immutable theme
version.

## Working with bundled themes

An ordinary `yarn manage deploy` never installs or updates either package.
Fresh-instance initialization is the only automatic installation path; later
theme changes use the same install, preview, and activation workflow as a
community theme.

Run the shared conformance suite after changing either package:

```console
yarn theme-kit:test
```

For repository authoring, Admin drafts, packaged assets, and storage details,
read the [versioned themes guide](../docs/dashboard/themes.md).
