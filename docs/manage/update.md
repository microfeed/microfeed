---
title: Update microfeed
description: Bring a connected production instance to the latest source and verify the deployment.
---

Update from the repository clone connected to the intended site.

## Recommended: ask your coding agent

Open the clone in a local coding agent and use a prompt that names the saved
site or Worker when you know it:

```text
Connect this repository to the microfeed Worker <worker-name>, update microfeed to the latest version, deploy it, and verify the site.
```

The agent should show you any uncommitted local changes before deployment,
fetch the trusted upstream repository, connect only if needed, deploy through
`yarn manage`, and run a status check.
Complete any Git or Cloudflare browser handoffs it requests.

## Manual update

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
