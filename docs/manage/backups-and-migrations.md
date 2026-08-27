---
title: Snapshots and migrations
description: Create portable whole-site backups, restore carefully, and migrate older Cloudflare Pages installations.
---

A microfeed snapshot packages the D1 schema and durable data together with every
object in the production R2 bucket. The archive also records checksums and the
ordered migration history needed to validate a restore.

In plain language, one snapshot contains the site’s database and uploaded
files. Treat it as private: it may include unpublished items, administrator
account data, and media that is not publicly linked.

The durable D1 set includes installed theme versions, unpublished Admin drafts,
and active/previous theme state. Because snapshots already include the entire
R2 bucket, declared theme assets restore in the same archive.

## Create a backup

```console
npx @microfeed/cli manage snapshot create \
  --instance <source-name> \
  --output <new-backup-file>.tar.gz
```

Expected result: a new archive at the requested path. Existing output files are
not overwritten. Store the archive like private site data; it can contain
unpublished content and media.

App-access connections, temporary CLI credentials, and dashboard sessions are
intentionally not portable. Run `yarn microfeed login <restored-site-url>`
before managing restored content.

## Test a production snapshot locally

```console
npx @microfeed/cli manage snapshot pull \
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

[Older microfeed deployments](https://github.com/microfeed/microfeed/tree/microfeed-classic) hosted with Cloudflare Pages use:

```console
npx @microfeed/cli manage migrate-pages
```

The command creates a new Worker beside the existing Pages project and connects
the new Worker to the same D1 database and R2 bucket. It does not delete or
modify the Pages project. Until you move the custom domain, both applications
can point at the same data, so a content change through either one is visible to
the other.

Verify the new Worker at its temporary address before moving the custom domain.
You can move the domain back to Pages if you need to reverse the traffic
switch; the shared data remains in D1 and R2.

See [the canonical migrate-pages reference](/manage-cli/#yarn-manage-migrate-pages) for all options.
