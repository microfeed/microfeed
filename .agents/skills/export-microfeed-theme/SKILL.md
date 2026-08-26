---
name: export-microfeed-theme
description: Initialize or export a microfeed theme from a saved instance into an independent local repository, then install, validate, test, and preview it safely. Use when a coding agent is asked to initialize, export, copy, fork, inspect, or begin developing the active or a specific installed theme from a microfeed instance.
---

# Initialize or export a microfeed theme

Use the project-owned `yarn manage` CLI from the microfeed repository root.
Read the theme section of [`docs/manage-cli.md`](../../../docs/manage-cli.md)
before using an unfamiliar option.

## Choose the repository identity

1. Run `yarn manage instances --json` and select the exact saved instance the
   user named. If several instances remain plausible, report their names and
   ask the user to choose.
2. Use `theme init` when the user wants a new independently versioned theme
   based on the site's effective appearance:

   ```console
   yarn manage theme init <output-directory> --instance <instance-name> --json
   ```

   Let the CLI choose the initial `local.<directory-name>` package ID unless
   the user supplied a package ID, name, version, or author. The command
   initializes Git by default; pass `--no-git` only when the user wants another
   tool to initialize the repository.
3. Use `theme export` when the user wants to preserve one exact installed
   package identity. Export the active installed version by default:

   ```console
   yarn manage theme export --active --instance <instance-name> --git --json
   ```

   When the user names an immutable theme ID, replace `--active` with that ID.
   Let the CLI choose `.microfeed/themes/<package-id>-<version>/` unless the
   user supplied another empty output directory.
4. Read the JSON result and report the source selection, package ID, version,
   output directory, and Git-initialization state. For export, also report the
   exact immutable theme ID.

Initialization and export are read-only for the instance. Never install,
activate, deactivate, delete, or otherwise change a live theme as part of this
workflow. Git initialization does not stage, commit, create a remote, or push.

## Verify the standalone repository

1. Change into the returned output directory and read `README.md`, `THEME.md`,
   `microfeed-theme.json`, and both generated schemas completely.
2. Run `yarn install`, then `yarn validate` and `yarn test`. Do not use
   dependencies from the parent microfeed workspace.
3. Start `yarn preview` with the bundled fixtures. Use `--feed-url` only when a
   public feed is needed. Confirm the printed local URL responds, then stop the
   preview process and confirm it exited.
4. Show `git status` and propose an initial commit message after every check
   passes. Stop before staging, committing, creating a remote, pushing, or
   opening a pull request unless the user explicitly requests those actions.

## Handle failures safely

- Never delete, empty, or overwrite a non-empty destination. Use another
  collision-resistant directory only with the user's approval.
- If Git initialization fails, keep and inspect the completed scaffold. Do not
  rerun export into that now-non-empty directory.
- If no installed version is active during export, explain that `theme init`
  can derive a new identity from the effective fallback; do not silently
  substitute it for an immutable export.
- If dependency installation is blocked, inspect the generated compatibility
  range and local Yarn configuration. Do not disable package gates globally or
  preapprove packages other than `@microfeed/theme-kit`.
- Keep exports under `.microfeed/themes/` when they should share the coding
  workspace. Do not use disposable `dist/` output. Warn that ignored-file
  cleanup can remove the local repository until it is committed and pushed
  elsewhere.

At handoff, list the exact commands run and all remaining local-only state.
