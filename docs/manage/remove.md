---
title: Remove a site safely
description: Plan and confirm removal without deleting unrelated or reused Cloudflare resources.
---

Removal can delete a Worker and site-owned data. Always begin with a read-only
plan for the exact instance:

```console
yarn manage destroy --instance <name> --dry-run
```

## Inspect the complete plan

Match every displayed item to the intended site:

- Cloudflare account.
- Worker and dashboard address.
- D1 database.
- R2 bucket and media-deletion scope.
- Custom domain or route.
- Any resource marked reused or preserved.

Open the Cloudflare dashboard inspection links printed by the command. Stop if
an identifier is unfamiliar or the plan includes content you need.

## Back up important content

Before destructive confirmation, create a snapshot to a new file and store it
safely. A dry run does not create a backup automatically.

## Confirm only the reviewed target

The destructive command requires the exact site name as confirmation. Follow
the plan’s printed command after you have approved that precise scope:

```console
yarn manage destroy --instance <name> --confirm <name>
```

`destroy` rejects blanket `--yes` approval and preserves resources recorded as
reused. Add `--keep-data` only when you deliberately want to remove the Worker
and local connection while preserving the site-owned D1 database and R2 bucket.

If removal stops midway, do not delete the remaining resources by hand. Rerun
the same management command so its saved journal can report or resume the
unfinished steps.

For the complete contract, read
[the `destroy` reference](/manage-cli/#yarn-manage-destroy).
