---
title: Multiple instances
description: Manage several production, preview, or local microfeed sites from one published launcher.
---

An instance name is the local label that selects one site’s saved configuration.
It is not a website address, Cloudflare account, or login. Give each instance a
name that clearly identifies its purpose or hostname.

## List saved instances

```console
npx @microfeed/cli manage instances
```

The output identifies production, preview, and local state and marks the
current default when one exists.

## Select the default

```console
npx @microfeed/cli manage use <instance-name>
```

You can also avoid changing the default by adding `--instance <name>` to a
supported command:

```console
npx @microfeed/cli manage status --instance personal-notes-example-com
npx @microfeed/cli manage deploy --instance studio-updates-example-com
```

## Add another site

Use `npx @microfeed/cli manage init --instance <name>` for a new site. Use
`npx @microfeed/cli manage connect --worker <worker-name> --instance <name>`
for an existing compatible Worker. Initialization may create Cloudflare
resources; connect is read-only in Cloudflare.

## Avoid targeting mistakes

Before a deployment, restore, authentication change, or removal:

1. Run `npx @microfeed/cli manage status --instance <name>`.
2. Match the Worker name and Cloudflare account to the intended site.
3. Use the same explicit `--instance` value for the change.

Never choose an account or instance only because it appears first in a list.
