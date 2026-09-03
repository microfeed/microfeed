---
title: 3. Use @microfeed/cli manually
description: Install microfeed by running the guided management commands yourself.
---

This path uses the terminal directly. The prompts explain the available choices
and the management engine stops before unsafe collisions or ambiguous account
selection. You do not need prior Cloudflare command-line experience.

Choose the command based on the code you want to deploy:

- `npx @microfeed/cli manage` deploys the official microfeed release bundled
  with the published CLI. You can run it from any folder.
- `yarn manage` deploys the code in the current Git-cloned source directory.
  Use it for the official repository, your own fork, or a custom repository
  that retains microfeed's management tooling.

## Deploy the official release

### 1. Prepare your computer

Install Node.js 22.12 or newer with npm. You do not need Git, Corepack, or a
Git-cloned copy of the microfeed source repository. The published launcher
carries a pinned Yarn runtime and prepares its matching release in a private
operating-system cache.

### 2. Discover your Cloudflare account

```console
npx @microfeed/cli manage accounts
```

Your browser may open for Cloudflare authorization. If the command lists more
than one account, note the exact account you want to use; do not choose based
only on list position.

### 3. Initialize the site

```console
npx @microfeed/cli manage init
```

Follow the prompts for the Cloudflare account, distinctive site name,
media storage, dashboard address, and login email. Initialization checks the
requested names before it creates a Worker, D1 database, or R2 bucket.

If R2 is not available yet, microfeed can finish as a content-only site. You
can publish text and external links, then enable media storage later.

### 4. Create the dashboard password

After deployment, microfeed opens a one-time password-creation page. Choose the
password in that page. Do not put it in a command or save the private link in a
shared document.

### 5. Check the deployment

```console
npx @microfeed/cli manage status
```

Expected result: a verified hosted application and dashboard status, plus the
exact D1 and R2 resources attached to the saved instance.

:::tip[Need every option?]
The [management CLI reference](/manage-cli/) is the canonical contract for all
commands, options, side effects, and safeguards.
:::

## Deploy from a Git-cloned source directory

Use this path when you want to deploy a particular branch, a fork, or your own
source-code changes instead of the official release bundled with
`@microfeed/cli`.

Open the source repository's root directory. Before deploying, inspect
`git status` and `git diff` so you know which branch and working-tree changes
the build will include. Prefer committing the intended version first so the
deployment's Git version metadata identifies the source you deployed.

The repository requires Node.js 22.12 or newer, Corepack, and its locked Yarn
dependencies:

```console
corepack enable
yarn install --immutable
```

Then run the same installation flow through the checkout's local management
engine:

```console
yarn manage accounts
yarn manage init
yarn manage status
```

Complete Cloudflare browser authorization and create the dashboard password in
the one-time browser page just as you would with the published CLI. The Worker
is built from the current source directory, so changes in a fork or local
working tree can affect the deployed application.

Next: [complete the post-deployment checklist](../after-deploy/).
