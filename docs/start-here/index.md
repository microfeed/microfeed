---
title: Quick start
description: Paste one prompt into a local AI agent to deploy microfeed to Cloudflare.
---

Open a local AI agent that can run terminal commands and complete a browser
handoff, then paste this prompt in any folder on your computer.

<div class="quickstart-agents" aria-label="Examples of local AI agents">
  <a class="quickstart-agent" href="https://openai.com/codex/">
    <img src="/images/agents/openai.svg" alt="" width="32" height="32" data-docs-image-lightbox-ignore>
    <span>Codex</span>
  </a>
  <a class="quickstart-agent" href="https://claude.com/product/claude-code">
    <img src="/images/agents/claude.svg" alt="" width="32" height="32" data-docs-image-lightbox-ignore>
    <span>Claude Code</span>
  </a>
  <a class="quickstart-agent" href="https://cursor.com/">
    <img src="/images/agents/cursor.svg" alt="" width="32" height="32" data-docs-image-lightbox-ignore>
    <span>Cursor</span>
  </a>
  <span class="quickstart-agent-more">or another capable local agent</span>
</div>

```text frame="terminal" wrap
Deploy microfeed to Cloudflare.
Start by running `npx @microfeed/cli manage`, then follow its instructions until
deployment is verified.
```

That is enough to begin. Stay nearby while the agent works: you sign in to
Cloudflare in your browser, choose between any ambiguous accounts or existing
sites, and create your private dashboard password yourself. Never paste a
Cloudflare token, dashboard password, or private setup link into the
conversation.

## What you need

- A computer with [Node.js 22.12 or newer](https://nodejs.org/). Its standard
  installer includes npm and `npx`. If `npx` is unavailable, ask the agent to
  help you install Node.js first, then use the same prompt again.
- A [Cloudflare account](https://dash.cloudflare.com/sign-up). Cloudflare’s
  included usage is enough for many personal and small sites; usage above its
  published limits may require a paid plan.
- An email address for the private dashboard login.

You do **not** need Git, Corepack, or a Git-cloned copy of microfeed's source
code. The published CLI contains the matching deployment source and Yarn
runtime.

## What happens next

1. The first command prepares the exact microfeed release in a private cache.
   Initial setup can take several minutes and use about 1.3 GB; it does not put
   source files in your current folder.
2. Cloudflare opens a browser page for you to sign in. The agent explains each
   important choice and asks before reusing an existing site or resource.
3. After deployment, you open a private one-time setup page and choose the
   dashboard password yourself.
4. The agent runs `npx @microfeed/cli manage status` and continues until the
   hosted application, dashboard protection, database, and media storage are
   verified.

The result is a microfeed site in your Cloudflare account with a public
website, RSS feed, JSON Feed, and private Admin dashboard.

<video class="docs-walkthrough" controls autoplay muted playsinline preload="metadata" poster="/images/screenshots/1-deploy-1.png" aria-label="A silent Codex deployment walkthrough progressing from the initial request through verification to the ready microfeed dashboard">
  <source src="/images/screenshots/1-deploy-walkthrough.mp4" type="video/mp4">
  <a href="/images/screenshots/1-deploy-walkthrough.mp4">Watch the microfeed deployment walkthrough.</a>
</video>

For detailed browser handoffs, screenshots, and recovery steps, continue to
[Deploy with a local AI agent](./ai-agent/). To run the same guided commands
yourself, follow [Deploy manually](./manual/). After installation, use the
[post-deployment checklist](./after-deploy/) to publish a test item and connect
the content CLI.

Codex, Claude Code, and Cursor are trademarks of their respective owners and
are shown only as examples.
