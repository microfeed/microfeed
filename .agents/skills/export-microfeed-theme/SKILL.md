---
name: export-microfeed-theme
description: Export an installed microfeed theme from a saved instance into an independent local repository, then install, validate, test, and preview it safely. Use when Codex is asked to export, copy, fork, inspect, or begin developing the active or a specific installed theme from a microfeed instance.
---

# Export a microfeed theme

Use the project-owned `yarn manage` CLI from the microfeed repository root.
Read the theme section of [`docs/manage-cli.md`](../../../docs/manage-cli.md)
before using an unfamiliar option.

## Export the immutable package

1. Run `yarn manage instances --json` and select the exact saved instance the
   user named. If several instances remain plausible, report their names and
   ask the user to choose.
2. Export the active installed version by default:

   ```console
   yarn manage theme export --active --instance <instance-name> --git --json
   ```

   When the user names an immutable theme ID, replace `--active` with that ID.
   Let the CLI choose `.microfeed/themes/<package-id>-<version>/` unless the
   user supplied another empty output directory.
3. Read the JSON result and report the exact package ID, version, theme ID,
   selection, output directory, and Git-initialization state.

Export is read-only for the instance. Never install, activate, deactivate,
delete, or otherwise change a live theme as part of this workflow. `--git`
only initializes the exported directory on `main`; it does not stage, commit,
create a remote, or push.

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
- If no installed version is active, explain that `theme init` can derive a
  new identity from the effective fallback; do not silently substitute it for
  an immutable export.
- If dependency installation is blocked, inspect the generated compatibility
  range and local Yarn configuration. Do not disable package gates globally or
  preapprove packages other than `@microfeed/theme-kit`.
- Keep exports under `.microfeed/themes/` when they should share the coding
  workspace. Do not use disposable `dist/` output. Warn that ignored-file
  cleanup can remove the local repository until it is committed and pushed
  elsewhere.

At handoff, list the exact commands run and all remaining local-only state.
