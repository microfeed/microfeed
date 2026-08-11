---
title: theme-kit cli reference
description: Complete command and option reference for the @microfeed/theme-kit authoring CLI.
---

`theme-kit` is the command-line tool provided by
[`@microfeed/theme-kit`](https://www.npmjs.com/package/@microfeed/theme-kit).
It creates, validates, tests, and previews a theme package on your computer. It
does not deploy microfeed, install a theme into an instance, or activate a live
theme.

Use [`yarn manage theme`](/manage-cli/#yarn-manage-theme) from a microfeed
checkout for instance operations such as export, install, update, activation,
rollback, and deletion. See [Themes and website code](/dashboard/themes/) for
the authoring workflow, storage model, and Vite, Webpack, Tailwind, D1, and R2
examples.

## Run the CLI

Choose the form that matches where you are working:

| Where you are working | Recommended command |
| --- | --- |
| Inside a generated theme repository | Install dependencies, then use `yarn theme-kit …` or its `yarn validate`, `yarn test`, and `yarn preview` scripts |
| One command without installation | `yarn dlx @microfeed/theme-kit …` |
| Regular use across unrelated directories | Install globally, then use `theme-kit …` |

Inside a generated theme repository, install its dependencies and use the
project-local executable:

```console
yarn install
yarn theme-kit --help
```

The generated repository also provides shorter scripts:

```console
yarn validate
yarn test
yarn preview
```

For one-off use without an existing theme repository, run the published
package directly:

```console
yarn dlx @microfeed/theme-kit --help
```

To install one shared executable for regular use across directories:

```console
npm install --global @microfeed/theme-kit
theme-kit --help
```

The package requires Node.js 22.12 or newer. The examples use Yarn 4, but npm
and pnpm can invoke the same executable.

Modern Yarn does not provide the older `yarn global add` workflow. A
project-local dependency is preferable when a theme repository should pin the
tool version; global installation is convenient for starting or inspecting
themes outside a repository.

Theme repositories created by earlier releases may still use the
`microfeed-theme` executable name. It remains available as a compatibility
alias, but new repositories and documentation use `theme-kit`.

## Command summary

| Command | Purpose | Changes the live site? |
| --- | --- | --- |
| `init <directory>` | Create a standalone generic theme package | No |
| `validate <directory>` | Validate the manifest, six theme files, and assets | No |
| `test <directory>` | Render and check every built-in and package fixture | No |
| `preview <directory>` | Start an isolated local preview server | No |
| `fixture pull <url>` | Save a public JSON Feed as a local fixture | No |
| `help [command]` | Show general or command-specific help | No |

## Global options

```console
theme-kit <command> [options]
```

| Option | Meaning |
| --- | --- |
| `-h`, `--help` | Show general help. Place it after a command for command-specific help. |
| `-v`, `--version` | Print the installed `@microfeed/theme-kit` version. |

Examples:

```console
theme-kit --help
theme-kit validate --help
theme-kit help fixture pull
theme-kit --version
```

Successful commands exit with status `0`. Invalid commands, invalid packages,
failed network requests, and failed checks exit with status `1` and write a
diagnostic to standard error. `validate --json` and `test --json` provide
machine-readable success and error output for coding agents and CI.

## `init`

```console
theme-kit init <directory>
```

Creates a generic theme package containing the manifest, six required theme
files, schemas, fixtures, local package scripts, `THEME.md`, and the
`develop-microfeed-theme` agent skill.

- Missing parent directories are created.
- The destination must be empty; existing files are never overwritten.
- When `<directory>` is omitted, the destination defaults to
  `./microfeed-theme`.
- The command does not initialize Git. Review the generated files before
  creating and publishing a standalone repository.

To initialize from a specific microfeed instance's active theme instead, use
`yarn manage theme init` from a microfeed checkout.

## `validate`

```console
theme-kit validate <directory> [--json]
```

Loads the complete installable package and validates:

- Manifest format, semantic version, and microfeed compatibility.
- The six declared text-file paths and their size limits.
- Mustache templates and the complete RSS XSL stylesheet.
- Declared asset paths, symlinks, file types, per-file limits, and total limits.
- Missing, undeclared, absolute, or traversing paths.

`<directory>` defaults to the current directory. Human output prints the
validated package metadata. JSON success output has this shape:

```json
{"assets":0,"ok":true,"packageId":"example.my-theme","version":"0.1.0"}
```

On failure, `--json` writes an object containing `ok: false` and a
`diagnostics` array.

## `test`

```console
theme-kit test <directory> [--json]
```

Validates the package, then renders these built-in fixtures:

- `empty`
- `minimal`
- `rich`
- `pagination`
- `media`
- `missing_optional`
- `authors_and_subscriptions`
- `hostile_html`

It then renders every `.json` file under the package's `fixtures/` directory.
Each case is rendered twice to detect nondeterministic output. The command
parses feed and item HTML and verifies that the rendered RSS stylesheet is
valid XML. Themes are trusted code, so this command checks output structure and
determinism rather than sanitizing intentional HTML or JavaScript.

`<directory>` defaults to the current directory. With `--json`, success output
contains `ok: true` and one `{fixture, ok}` entry for every completed case.

## `preview`

```console
theme-kit preview <directory> [options]
```

Starts an isolated server on a random local address and prints the URL to open
in a browser. The preview provides feed, item, and rendered RSS views plus a
mobile/desktop viewport switch. It uses the production theme renderer, serves
declared assets from a local `/assets/` route, disables caching, and applies a
sandboxed content security policy.

| Option | Meaning |
| --- | --- |
| `--fixture <name-or-file>` | Use one built-in fixture name or the path to a JSON fixture file. |
| `--feed-url <url>` | Download a public microfeed JSON Feed and use it as preview data. |

When neither option is supplied, preview uses the `minimal` fixture. Use only
one data option at a time. `<directory>` defaults to the current directory.

The server continues running until you stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd>.
Previewing never installs or activates the package.

## `fixture pull`

```console
theme-kit fixture pull <json-feed-url> --output <file>
```

Downloads a public JSON Feed, validates it against the theme render context,
and writes formatted JSON to `<file>`.

- `<json-feed-url>` must be publicly reachable; the command never signs in to
  an Admin API.
- `--output` is required.
- The output file must not already exist and its parent directory must already
  exist.
- Review copied titles, descriptions, media URLs, and other content before
  committing the fixture to a public repository.

Use the saved path with `preview --fixture <file>`, or keep it under
`fixtures/` so `test` includes it automatically.

## Typical local sequence

```console
theme-kit validate . --json
theme-kit test . --json
theme-kit preview . --fixture media
```

After the local checks pass, increment the theme's semantic version and commit
both source files and generated runtime files. Installation and activation are
separate `yarn manage theme` operations performed from a microfeed checkout.
