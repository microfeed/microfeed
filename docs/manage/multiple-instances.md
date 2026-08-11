---
title: Multiple instances
description: Manage several production, preview, or local microfeed sites from one repository clone.
---

An instance name is the local label that selects one site’s saved configuration.
It is not a website address, Cloudflare account, or login. Give each instance a
name that clearly identifies its purpose or hostname.

## List saved instances

```console
yarn manage instances
```

The output identifies production, preview, and local state and marks the
current default when one exists.

## Select the default

```console
yarn manage use <instance-name>
```

You can also avoid changing the default by adding `--instance <name>` to a
supported command:

```console
yarn manage status --instance personal-notes-example-com
yarn manage deploy --instance studio-updates-example-com
```

## Add another site

Use `yarn manage init --instance <name>` for a new site. Use
`yarn manage connect --worker <worker-name> --instance <name>` for an existing
compatible Worker. Initialization may create Cloudflare resources; connect is
read-only in Cloudflare.

## Avoid targeting mistakes

Before a deployment, restore, authentication change, or removal:

1. Run `yarn manage status --instance <name>`.
2. Match the Worker name and Cloudflare account to the intended site.
3. Use the same explicit `--instance` value for the change.

Never choose an account or instance only because it appears first in a list.
