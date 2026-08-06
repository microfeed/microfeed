---
title: Choose your path
description: Pick the easiest way to deploy your first microfeed site.
---

The outcome is the same whichever path you choose: a microfeed site in your
Cloudflare account, a private admin dashboard, and public Web, RSS, and JSON
feeds.

## Recommended: use a local AI coding agent

Choose this path if you want the agent to run commands, explain decisions, and
verify the result. You still control browser sign-in, Cloudflare account
selection, and your private dashboard password.

[Deploy with an AI agent →](./ai-agent/)

## Alternative: run the guided commands yourself

Choose this path if you are comfortable using a terminal and want direct
control. The same `yarn manage` command used by agents performs account
discovery, collision checks, deployment, and verification.

[Deploy manually →](./manual/)

## Before you start

You need:

- A computer with [Git](https://git-scm.com/downloads) and
  [Node.js 24](https://nodejs.org/) installed.
- A [Cloudflare account](https://dash.cloudflare.com/sign-up). The free plans
  are enough for many personal and small sites, although Cloudflare may ask you
  to enable R2 separately before media uploads are available.
- An email address for the built-in dashboard login, unless you deliberately
  choose an unprotected dashboard.

Not sure what a Worker, D1 database, or R2 bucket is? Read
[How microfeed works](./concepts/) first.
