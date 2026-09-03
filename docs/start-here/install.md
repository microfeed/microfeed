---
title: Different ways to install
description: Compare three supported ways to install microfeed on Cloudflare.
---

microfeed supports three installation paths. They all use the same guarded
deployment engine to create and verify the Worker, D1 database, and optional R2
media bucket in your Cloudflare account. Choose the interface and execution
environment that fit you best.

## Compare the installation methods

| Method | Best for | Advantages | Tradeoffs |
| --- | --- | --- | --- |
| [1. Use a local AI agent](/start-here/ai-agent/) | The simplest guided installation | Start with one prompt; the agent runs the commands, handles recovery, and verifies the deployment. Your dashboard password is created in a private browser page. | Requires a compatible local Node.js environment and an agent that can use the terminal. Stay nearby for Cloudflare authorization and important choices. |
| [2. Use GitHub Actions](/start-here/github-actions/) | Avoiding local operating-system or dependency problems | Runs in a consistent hosted Ubuntu environment, requires no local Node.js or Git installation, and keeps your deployment workflow in a fork you control. | Requires a GitHub fork, repository settings, and Cloudflare browser authorization for each run. The initial dashboard password is temporarily stored as a GitHub secret. |
| [3. Use @microfeed/cli manually](/start-here/manual/) | Direct control over the command and source code | Deploy the official release with `npx @microfeed/cli manage`, or deploy an official, forked, or locally modified checkout with `yarn manage`. | Requires a compatible local Node.js environment. A source checkout also requires Git, Corepack, and installed dependencies. |

All three methods require a Cloudflare account. Cloudflare authorization opens
in your browser, so you do not need to create or paste a Cloudflare API token.

## Official release or your own source code

The local AI agent and manual paths can use either of these commands, depending
on which code you want to deploy:

- `npx @microfeed/cli manage` prepares and deploys the official microfeed
  release bundled with the published `@microfeed/cli` package. It works from
  any folder and does not require a source checkout.
- `yarn manage` deploys from the Git-cloned source directory where you run it.
  That checkout can be the official repository, your own fork, or a custom
  repository that retains microfeed's management tooling.

Both commands use the same guarded management engine. The important difference
is the source code being built and deployed. GitHub Actions also checks out the
branch you select and runs `yarn manage`, so it deploys the code from that
branch in your fork.

## Choose a path

### 1. Use a local AI agent

This is the recommended starting point. Give a local coding agent one prompt,
then let it guide the deployment and verify the result.

[Install with a local AI agent →](/start-here/ai-agent/)

### 2. Use GitHub Actions

Choose this when local Node.js or operating-system compatibility is a problem,
or when you prefer a repeatable GitHub-hosted Ubuntu runner.

[Install with GitHub Actions →](/start-here/github-actions/)

### 3. Use @microfeed/cli manually

Choose this when you want to run the guided management commands yourself from
your local terminal, either from the official published release or from a
Git-cloned source directory you control.

[Install with @microfeed/cli →](/start-here/manual/)
