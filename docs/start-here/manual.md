---
title: Deploy manually
description: Install microfeed by running the guided yarn manage commands yourself.
---

This path uses the terminal directly. The prompts explain the available choices
and the CLI stops before unsafe collisions or ambiguous account selection.

## 1. Install the project

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install --immutable
```

Expected result: Yarn completes without changing the lockfile.

## 2. Discover your Cloudflare account

```console
yarn manage accounts
```

Your browser may open for Cloudflare authorization. If the command lists more
than one account, note the exact account you want to use; do not choose based
only on list position.

## 3. Initialize the site

```console
yarn manage init
```

Follow the prompts for the Cloudflare account, globally distinctive site name,
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
yarn manage status
```

Expected result: a verified Worker and dashboard status, plus the exact D1 and
R2 resources attached to the saved instance.

:::tip[Need every option?]
The [`yarn manage` reference](/manage-cli/) is the canonical contract for all
commands, options, side effects, and safeguards.
:::

Next: [complete the post-deployment checklist](./after-deploy/).
