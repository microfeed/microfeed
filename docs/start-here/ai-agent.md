---
title: Deploy with an AI coding agent
description: The recommended three-step route to a new microfeed site.
---

Use a local coding agent that can run terminal commands and open browser pages.
The agent reads microfeed’s repository instructions and operates the same
guarded `yarn manage` CLI available to people.

## 1. Copy microfeed to your computer

Open a terminal and run:

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
```

Expected result: a new `microfeed` folder containing this repository.

## 2. Open the folder in your coding agent

Open that folder in OpenAI Codex, Claude Code, Cursor, or another local coding
agent. Then paste this prompt:

```text
Deploy microfeed to Cloudflare.
```

The agent should discover your Cloudflare login, ask you to choose an account
if more than one is available, initialize a site, and verify the finished
deployment.

<video class="docs-walkthrough" controls autoplay muted playsinline preload="metadata" poster="/images/screenshots/1-deploy-1.png" aria-label="A silent Codex deployment walkthrough progressing from the initial request through verification to the ready microfeed dashboard">
  <source src="/images/screenshots/1-deploy-walkthrough.mp4" type="video/mp4">
  <a href="/images/screenshots/1-deploy-walkthrough.mp4">Watch the microfeed deployment walkthrough.</a>
</video>

## 3. Complete browser handoffs

Stay nearby for these steps:

- Cloudflare opens a browser page so you can sign in and authorize Wrangler.
- The agent asks before reusing resources or making important choices.
- The finished deployment opens a private, one-time page where **you** create
  the dashboard password.

Never paste a Cloudflare token, dashboard password, or private password-setup
link into the agent conversation.

## Verify the result

Ask the agent to run `yarn manage status`. The final report should show the
site address, dashboard protection, D1 database, and R2 state. Open the
public address and confirm the site loads. You can sign in to the dashboard and
publish a test item yourself, or follow the
[post-deployment checklist](../after-deploy/) to enable `yarn microfeed` for
the agent.

If setup stops partway through, tell the agent to continue the same microfeed
deployment. Initialization is designed to resume without recreating resources.

Next: [complete the post-deployment checklist](../after-deploy/).
