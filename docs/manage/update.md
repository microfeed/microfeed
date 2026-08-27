---
title: Update microfeed
description: Bring a connected production instance to the latest source and verify the deployment.
---

Use the clone-free launcher or update from a repository clone connected to the
intended site.

## Recommended: ask your coding agent

Open a local coding agent and use a prompt that names the saved site or Worker
when you know it:

```text
Run `npx @microfeed/cli manage` and follow every instruction it prints. Connect
to the microfeed Worker <worker-name> if it is not already saved, deploy the
latest release, and continue until `status` verifies the site.
```

The launcher obtains the exact release in a private cache. The agent discovers
saved and compatible existing sites, asks before choosing among candidates,
connects only if needed, deploys through the same `yarn manage` engine, and
runs a status check. Complete any Git or Cloudflare browser handoffs it
requests.

## Manual update from a clone

First run `git status` and protect any local work. Then fetch and inspect
upstream changes using your normal Git workflow. Once the clone contains the
version you intend to run:

```console
yarn install --immutable
yarn manage deploy
yarn manage status
```

`deploy` applies database migrations, completes required data normalization
(including stored plain text for item search), runs project checks, builds the
Worker, tags the deployed version with the source commit, deploys, reconciles
data written during the version switch, and verifies it.

## If this clone is not connected

Do not initialize over an existing Worker. Connect first:

```console
yarn manage connect --worker <worker-name> --instance <local-name>
```

The connect operation is read-only in Cloudflare: it verifies a compatible
microfeed Worker and saves local connection state.

## Recovery

If deployment stops, read the final error before retrying. The CLI keeps saved
state for resumable resource changes. If the site still serves the previous
version, run `yarn manage status` and resolve the reported account, resource, or
migration problem before another deploy.
