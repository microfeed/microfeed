---
title: 1. Use a local AI agent
description: Ask a local coding agent to update and verify an existing microfeed site.
---

This is the recommended update method. A local coding agent can discover the
saved site, connect an existing compatible Worker when needed, deploy the new
release, and verify the result.

Your computer needs Node.js 22.12 or newer with npm. You do not need to clone
the microfeed source repository.

## Give the agent one prompt

Open Codex, Claude Code, Cursor, or another local agent that can run terminal
commands and open browser pages. Paste this prompt, replacing the placeholder
when you know the site's address:

```text
Update the microfeed site <site-url> to the latest release. Start by running
`npx @microfeed/cli manage`, connect the existing site if needed, deploy the
update, and continue until `status` verifies the site.
```

The launcher prepares its exact bundled release in a private local cache. The
agent should identify the intended saved instance or compatible Worker, ask
before choosing among multiple candidates, and use the repository-owned
management engine for the update.

## Complete browser authorization

Cloudflare may open a browser page so you can sign in and authorize Wrangler.
Complete that handoff yourself. Never paste a Cloudflare token, microfeed
password, or private password-setup link into the agent conversation.

## Verify the result

The agent should finish by running `npx @microfeed/cli manage status` for the
same instance. Confirm that the report identifies the intended Worker and
shows the site, dashboard protection, D1 database, and R2 state as verified.

If the update stops, tell the agent to read the final error and continue the
same microfeed update. Deployment state is designed to resume safely.
