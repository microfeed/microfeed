# Contributing to microfeed

Thank you for helping improve microfeed. Keep contributions focused, explain
why the change is useful, and leave the project easier to maintain.

## Before you start

- Search the existing [issues](https://github.com/microfeed/microfeed/issues)
  and pull requests before starting duplicate work.
- Open an issue before a substantial feature or architectural change so the
  approach can be discussed. Small fixes and documentation improvements may go
  directly to a pull request.
- Never include passwords, API tokens, `.dev.vars`, `.microfeed/`, production
  data, or other private configuration in an issue, commit, or pull request.

## Set up local development

Use Node.js 24 and Corepack. The package supports Node.js `>=22.12.0`, but
development and CI use Node.js 24 without pinning a patch release. Windows ARM
computers are supported through Windows' x64 application emulation: install
the x64 build of Node.js because Cloudflare's local runtime does not provide a
native Windows ARM64 executable. Confirm the active build with
`node -p "process.arch"`; it must print `x64`.

```console
corepack enable
yarn install --immutable
yarn manage init --local --instance my-podcast-custom-com
yarn dev --instance my-podcast-custom-com
```

Local instances use isolated D1 and R2 simulations and never access or copy
production data. Create another instance by choosing another name:

```console
yarn manage init --local --instance jacks-photo-album-com
yarn dev --instance jacks-photo-album-com
```

The development URL is printed by Astro. Only one development server at a time
is supported.

## Choose a branch

Do not commit directly to `main`. Use a lowercase, kebab-case topic branch in
the form `<type>/<short-description>`:

| Type | Use for | Example |
| --- | --- | --- |
| `feature` | New user-facing behavior | `feature/new-editor` |
| `fix` | Defect corrections | `fix/media-upload-timeout` |
| `docs` | Documentation only | `docs/local-development` |
| `refactor` | Behavior-preserving restructuring | `refactor/feed-builder` |
| `test` | Test-only changes | `test/password-setup` |
| `ci` | Continuous-integration changes | `ci/update-actions` |
| `chore` | Cross-cutting repository maintenance | `chore/development-workflow` |

Choose the type that describes the primary outcome. Existing nonconforming
branches may be completed, but new work should follow this convention.

## Make a focused change

- Follow the architecture and component rules in [AGENTS.md](AGENTS.md).
- Keep Astro and Worker application code under `src/`; respect the boundaries
  between `src/server/`, `src/client/`, and `src/shared/`.
- Keep deployment tooling in `manage-cli/` and update `docs/manage-cli.md` plus
  `manage-cli/help.ts` together whenever command behavior changes.
- Add or update tests for behavior changes and regression fixes.
- Update documentation when commands, public behavior, or contributor
  expectations change.
- Avoid unrelated formatting, dependency, or refactoring changes.

Write focused commits with concise imperative titles such as
`Handle expired upload URLs`. Conventional Commit prefixes are welcome but not
required.

## Validate the change

Run relevant targeted tests while developing. Before opening a pull request,
run the complete repository check:

```console
yarn check
```

This type-checks the project, runs unit and Worker tests, builds the production
application, and verifies the Worker bundle with a dry run. Also run
`git diff --check` and review the complete diff for generated files and
secrets.

## Prepare release metadata

Set the application, published CLI, theme kit, and compatible starter range
with one command:

```console
yarn version:set 1.2.3
```

Use an exact semantic version. The command verifies every target before it
writes anything. Bundled themes have their own immutable versions; when a
bundled theme changes, increment that theme's version and run
`yarn theme:release` to record its canonical checksum. Private workspace
metadata, examples, fixtures, tests, and the lockfile do not need patch-release
edits.

## Open a pull request

- Open the pull request as a draft until the change and validation are ready
  for review.
- Use a concise imperative title and explain what changed, why, the impact,
  tests performed, and any known risks.
- Link an issue when one exists; an issue is not required for a small fix.
- Include before-and-after screenshots for visible interface changes.
- Keep the pull request to one logical outcome and respond to review feedback
  with focused follow-up commits.

By contributing, you agree that your contribution is licensed under the
repository's [GNU Affero General Public License v3.0](LICENSE).
