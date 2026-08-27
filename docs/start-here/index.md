---
title: Quick start
description: Deploy your first microfeed site to Cloudflare with a local coding agent.
---

This is the shortest path to a working microfeed site. A local coding agent runs
the setup commands, explains each choice, and verifies the result. You remain
in control of Cloudflare sign-in and your private dashboard password.

## Before you begin

You need:

- A [Cloudflare account](https://dash.cloudflare.com/sign-up). Cloudflare’s
  included usage is enough for many personal and small sites; usage above the
  published limits may require a paid plan.
- A computer with [Git](https://git-scm.com/downloads),
  [Node.js 22.12 or newer](https://nodejs.org/), npm, and Corepack installed.
- A local coding agent such as OpenAI Codex, Claude Code, or Cursor that can run
  terminal commands in a folder on your computer.
- An email address for the private dashboard login.

## Deploy with an agent

1. Open a local coding agent in any folder on your computer. The agent must run
   locally so Cloudflare can hand browser authorization back to it.

2. Ask the agent:

   ```text frame="terminal" wrap
   Deploy microfeed to Cloudflare. Start by running `npx @microfeed/cli manage`,
   then follow its instructions until deployment is verified.
   ```

3. Stay nearby while the agent works. The first command downloads the exact
   microfeed release and its dependencies into a private cache; it does not
   create source files in your current folder. Cloudflare opens a browser page
   for you to sign in, and the agent may ask you to select an account or
   approve an important choice. Never paste a Cloudflare token or dashboard
   password into the conversation.

4. When deployment finishes, open the private one-time setup page and choose
   your dashboard password. Then open the public site and publish a test item.
   Use the dashboard yourself, or follow the
   [post-deployment checklist](./after-deploy/) to enable the official
   [`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli) for a coding
   agent.

The result is a microfeed site in your Cloudflare account with a public
website, RSS feed, JSON Feed, and private Admin dashboard.

<video class="docs-walkthrough" controls autoplay muted playsinline preload="metadata" poster="/images/screenshots/1-deploy-1.png" aria-label="A silent Codex deployment walkthrough progressing from the initial request through verification to the ready microfeed dashboard">
  <source src="/images/screenshots/1-deploy-walkthrough.mp4" type="video/mp4">
  <a href="/images/screenshots/1-deploy-walkthrough.mp4">Watch the microfeed deployment walkthrough.</a>
</video>

## Confirm the installation

Ask the agent to run `npx @microfeed/cli manage status`. The report should
confirm the hosted application, dashboard protection, content database, and
media storage. If setup stopped partway through, ask the agent to continue the
same microfeed deployment; the installer is designed to resume safely.

For screenshots, browser handoffs, and recovery steps, continue to
[Deploy with an AI coding agent](./ai-agent/).

## Prefer to use the terminal yourself?

Follow [Deploy manually](./manual/) to run the same guided
`npx @microfeed/cli manage` workflow without an agent or a copy of the
microfeed source code. If Worker, D1, or R2 are unfamiliar terms, read [How
microfeed works](./concepts/) before installing.
