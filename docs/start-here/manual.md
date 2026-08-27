---
title: Deploy manually
description: Install microfeed by running the guided management commands yourself.
---

This path uses the terminal directly. The prompts explain the available choices
and the CLI stops before unsafe collisions or ambiguous account selection.
You do not need prior Cloudflare command-line experience.

## 1. Prepare your computer

Install Node.js 22.12 or newer with npm. You do not need Git, Corepack, or a
Git-cloned copy of the microfeed source repository. The published launcher
carries a pinned Yarn runtime and prepares its matching release in a private
operating-system cache.

## 2. Discover your Cloudflare account

```console
npx @microfeed/cli manage accounts
```

Your browser may open for Cloudflare authorization. If the command lists more
than one account, note the exact account you want to use; do not choose based
only on list position.

## 3. Initialize the site

```console
npx @microfeed/cli manage init
```

Follow the prompts for the Cloudflare account, distinctive site name,
media storage, dashboard address, and login email. Initialization checks the
requested names before it creates a Worker, D1 database, or R2 bucket.

If R2 is not available yet, microfeed can finish as a content-only site. You
can publish text and external links, then enable media storage later.

## 4. Create the dashboard password

After deployment, microfeed opens a one-time password-creation page. Choose the
password in that page. Do not put it in a command or save the private link in a
shared document.

## 5. Check the deployment

```console
npx @microfeed/cli manage status
```

Expected result: a verified hosted application and dashboard status, plus the
exact D1 and R2 resources attached to the saved instance.

:::tip[Need every option?]
The [management CLI reference](/manage-cli/) is the canonical contract for all
commands, options, side effects, and safeguards.
:::

## Shortcut from the source repository

If you already have a Git-cloned microfeed source repository and have run
`yarn install`, you can replace the `npx @microfeed/cli manage` prefix above
with `yarn manage`. This runs that source repository's local version of the
same management engine; a Git-cloned microfeed source repository is not
required for deployment.

Next: [complete the post-deployment checklist](../after-deploy/).
