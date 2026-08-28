---
title: Deploy with a local AI agent
description: Detailed browser handoffs and recovery steps for an agent-guided deployment.
---

Use a local AI agent that can run terminal commands and open browser pages.
The published launcher prepares an exact microfeed release in a private cache,
then directs the agent to the same guarded management engine available in the
microfeed source repository. You do not need to Git-clone or open that source
repository yourself.

## 1. Open a local AI agent

Open Codex, Claude Code, Cursor, or another capable local AI agent that can run
terminal commands on your computer and complete a browser handoff. The current
folder does not need to contain source code.

Your computer needs Node.js 22.12 or newer with npm. The published launcher
includes its own Yarn runtime and deployment source, so ordinary deployment
does not require Git or Corepack.

## 2. Give the agent one command

Paste this prompt:

```text
Deploy microfeed to Cloudflare.
Start by running `npx @microfeed/cli manage`, then follow its instructions until
deployment is verified.
```

The first run verifies and copies the exact release bundled with
`@microfeed/cli`, then installs the locked dependencies in your operating
system cache with the included Yarn runtime. This may use about 1.3 GB and take
several minutes, depending on your connection and computer. Later commands
reuse that workspace, while saved
deployment state lives separately so a cache refresh cannot erase your site
connections.

The command prints the exact deployment-skill and reference paths for the
agent to read. The agent should discover your Cloudflare login, ask you to
choose an account or existing compatible site when necessary, initialize only
when you want a new site, and verify the finished deployment.

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

Ask the agent to run `npx @microfeed/cli manage status`. The final report
should show the site address, dashboard protection, D1 database, and R2 state.
Open the public address and confirm the site loads. You can sign in to the
dashboard and publish a test item yourself, or follow the
[post-deployment checklist](../after-deploy/) to enable `@microfeed/cli` for
the agent.

If setup stops partway through, tell the agent to continue the same microfeed
deployment. Initialization is designed to resume without recreating resources.

Next: [complete the post-deployment checklist](../after-deploy/).
