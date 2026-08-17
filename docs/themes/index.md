---
title: Build and release a theme
description: Start a standalone theme repository, develop and preview it safely, then install and activate an immutable release.
---

A theme repository is an independent project containing the templates and
optional assets that render a microfeed public site. Develop it outside the
microfeed source checkout, validate it locally, and install each semantic
version as an inactive release before activation.

## Choose a starting point

| Goal | Command |
| --- | --- |
| Fork the selected site's current appearance under a new identity | `yarn manage theme init <directory> --instance <instance-name>` |
| Export an exact installed immutable version with its existing identity | `yarn manage theme export <theme-id> --instance <instance-name>` |
| Start from a generic package without reading an instance | `yarn dlx @microfeed/theme-kit init <directory>` |

Use `theme init` for a new design derived from the site's effective theme. Use
`theme export` when package identity and version must remain the development
baseline. Both are rendered-package exports; they cannot recreate private
source files or build tools that were not part of the installed package.

## Start from the current site

Run this from the connected microfeed clone, using a destination outside that
checkout:

```console
yarn manage theme init ~/microfeed-themes/my-theme \
  --instance <instance-name>
cd ~/microfeed-themes/my-theme
yarn install
yarn validate
yarn test
```

The command creates missing parent directories but refuses a non-empty
destination. It copies the effective theme, declared assets, package scripts,
schemas, fixtures, instructions, and the `develop-microfeed-theme` agent skill.
By default it creates an independent Git repository on `main` with a new
`local.my-theme@0.1.0` identity.

Use `--package-id`, `--name`, `--version`, and `--author` to choose publishable
metadata. Use `--no-git` when another tool owns Git initialization.

## Export an installed version

List installed versions, then export the exact one you intend to preserve:

```console
yarn manage theme list --instance <instance-name>
yarn manage theme export <theme-id> \
  --instance <instance-name> \
  --git \
  --json
```

Use `--active` instead of a theme ID to export the active installed version.
The command writes a verified package to an empty directory and can initialize
Git, but it does not stage, commit, create a remote, push, install, activate,
or otherwise change the live site.

Inside a microfeed clone, the default export destination is the ignored
`.microfeed/themes/<package-id>-<version>/` workspace. Commit and push the
standalone repository when you are ready to preserve it independently; cleanup
of ignored files can otherwise remove it.

## Start from the generic package

Use the authoring kit when no existing site should supply the design:

```console
yarn dlx @microfeed/theme-kit init ~/microfeed-themes/my-theme
cd ~/microfeed-themes/my-theme
yarn install
yarn validate
yarn test
yarn preview
```

The generated project includes a manifest, eight format-v2 theme files,
fixtures, schemas, package scripts, an empty lockfile, and the theme-development
agent skill. It also includes `CLAUDE.md`, which directs Claude Code to that
same canonical skill; other compatible coding agents can discover the
`.agents/skills/develop-microfeed-theme/` copy directly. Review the files before
initializing or publishing a repository.

## Develop with a coding agent

Open only the generated theme directory in the coding agent. A useful first
prompt is:

```text
Build a responsive editorial theme from this package. Read THEME.md,
microfeed-theme.json, and the generated schemas before editing. Keep every
declared theme file valid, use the provided fixtures, run validation and tests,
then preview feed, item, Page, Search, and RSS views at desktop and mobile
sizes. Do not install or activate the theme.
```

The normal development loop is:

1. Edit declared templates and local build sources.
2. Build any static browser assets.
3. Run `yarn validate` and `yarn test`.
4. Run `yarn preview` with fixtures or a public JSON Feed.
5. Increment the semantic version before installation.

The [theme contract](/themes/contract/) describes the templates and render
context. The [asset guide](/themes/assets/) covers Vite, Webpack, Tailwind,
inline output, and packaged files.

## Validate, test, and preview

```console
yarn validate
yarn test
yarn preview
yarn preview --fixture media
yarn preview --feed-url https://example.com/json/
```

Validation checks the manifest, declared templates, Mustache syntax, semantic
version, compatibility range, asset paths, and package limits. Tests render
built-in and package fixtures twice to detect invalid or nondeterministic
output. Preview runs locally until stopped with <kbd>Ctrl</kbd>+<kbd>C</kbd> and
never installs or activates the package.

For every option and output contract, use the
[`@microfeed/theme-kit` reference](/theme-kit-cli/).

## Install and release a version

After validation and review, install the repository from the connected
microfeed clone:

```console
yarn manage theme install https://github.com/owner/theme-repository \
  --instance <instance-name>
yarn manage theme list --instance <instance-name>
```

Installation resolves a Git ref to one exact commit, validates the declared
files, stores an immutable inactive version, and uploads declared assets when
needed. It never activates the result. Preview the installed version, then
activate its exact theme ID separately:

```console
yarn manage theme activate <theme-id> --instance <instance-name>
```

Use `theme update` to install a newer version from the recorded source and
`theme rollback` to return to the recorded previous version. Never reuse one
package ID and version for different content. Delete only inactive versions
that are no longer needed.

See the canonical [`yarn manage theme`
reference](/manage-cli/#yarn-manage-theme) for source selection, local and
preview environments, update, rollback, export, and deletion behavior.

## Verify the release

Open feed, item, Page, Search, and RSS views after activation. Check mobile and
desktop layouts, navigation, keyboard search, rich content, missing optional
fields, and media. If the live result is wrong, roll back to the previous
installed version and fix the standalone repository under a new semantic
version.

Site owners making a small Admin-only change can return to [Themes and website
code](/dashboard/themes/).
