---
title: Snapshots and migrations
description: Create portable whole-site backups, restore carefully, and migrate older Cloudflare Pages installations.
---

A microfeed snapshot packages the D1 schema and durable data together with every
object in the production R2 bucket. The archive also records checksums and the
ordered migration history needed to validate a restore.

## Create a backup

```console
yarn manage snapshot create \
  --instance <source-name> \
  --output <new-backup-file>.tar.gz
```

Expected result: a new archive at the requested path. Existing output files are
not overwritten. Store the archive like private site data; it can contain
unpublished content and media.

## Test a production snapshot locally

```console
yarn manage snapshot pull \
  --instance <source-name> \
  --local-instance <new-local-name>
```

This downloads a temporary snapshot, restores it into a new local instance,
and removes the temporary archive. It does not change production.

## Restore remotely

Remote restore replaces data and therefore has stricter requirements. The
target must be a newly initialized, unchanged deployment. First run the exact
restore with `--dry-run`, inspect the source and target, then use
`--confirm <target-instance-name>` only when every identifier matches.

See [the canonical snapshot reference](/manage-cli/#yarn-manage-snapshot) for
eligibility checks, resumable maintenance state, and all options.

## Migrate an older Pages installation

Older microfeed deployments hosted with Cloudflare Pages use:

```console
yarn manage migrate-pages
```

The guided workflow discovers the source, creates or selects the supported
Worker-based target, and verifies the migration. Do not improvise a direct
database copy; migration history and media relationships must stay consistent.
