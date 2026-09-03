---
title: 3. Use @microfeed/cli manually
description: Update an existing microfeed site by running the management CLI yourself.
---

Use this path when you want to operate the update directly from your terminal.
Choose the command based on the code you want to deploy:

- `npx @microfeed/cli manage` deploys the official microfeed release bundled
  with the published CLI. You can run it from any folder.
- `yarn manage` deploys the code in the current Git-cloned source directory.
  Use it for an official checkout, your own fork, or a custom repository that
  retains microfeed's management tooling.

## Update to the official release

Your computer needs Node.js 22.12 or newer with npm. Run the guided launcher
from any folder:

```console
npx @microfeed/cli manage
```

Select the existing site and choose the deployment operation. If you already
know the saved instance name, you can run the commands directly:

```console
npx @microfeed/cli manage deploy --instance <instance-name>
npx @microfeed/cli manage status --instance <instance-name>
```

Complete Cloudflare browser authorization when requested. `status` should
identify the intended Worker and verify the site, dashboard protection, D1
database, and R2 state.

### Connect an existing Worker first

Do not initialize over an existing Worker. If the local launcher has no saved
connection for the site, connect it first:

```console
npx @microfeed/cli manage connect --worker <worker-name> --instance <instance-name>
npx @microfeed/cli manage deploy --instance <instance-name>
npx @microfeed/cli manage status --instance <instance-name>
```

The connect operation is read-only in Cloudflare. It verifies a compatible
microfeed Worker and saves the local connection state.

## Update from a Git-cloned source directory

Use this path when you want to deploy a particular branch, a fork, or your own
source-code changes instead of the official release bundled with
`@microfeed/cli`.

Open the repository root, fetch and inspect upstream changes using your normal
Git workflow, and run `git status` and `git diff`. The build includes the
current working tree, including local modifications. Prefer committing the
intended version first so the deployment's Git version metadata identifies the
source you deployed.

The repository requires Node.js 22.12 or newer, Corepack, and its locked Yarn
dependencies. Once the checkout contains the version you intend to deploy:

```console
corepack enable
yarn install --immutable
yarn manage deploy --instance <instance-name>
yarn manage status --instance <instance-name>
```

If this checkout has no saved connection for the existing Worker, connect it
before deploying:

```console
yarn manage connect --worker <worker-name> --instance <instance-name>
yarn manage deploy --instance <instance-name>
yarn manage status --instance <instance-name>
```

`yarn manage` runs the checkout's local version of the same guarded management
engine, but builds the code from that checkout rather than the published CLI's
official release. If an update stops, read the final error, run `status`,
resolve the reported problem, and retry the same deployment.
