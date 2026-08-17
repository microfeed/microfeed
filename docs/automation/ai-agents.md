---
title: Manage content with AI agents
description: Give a local coding agent a content task while browser authorization, credentials, and destructive approval remain under your control.
---

Use `@microfeed/cli` when a person asks a local coding agent to work on drafts,
upload media, or publish content. The CLI wraps the API in task-oriented
commands and keeps its browser-granted credentials opaque.

This is an interactive workflow: the person supplies the task and remains
available for browser consent and destructive confirmation. A persistent
service that reacts asynchronously should instead follow [Build webhook
endpoints](/webhooks/endpoints/) and the `build-microfeed-automation` skill.

## Give the agent an outcome, not a credential

Include the site, the content outcome, and the approval boundary in the prompt:

```text
Use @microfeed/cli to create a draft item on https://feed.example.com from
article.md. Use --json, show me the draft before publishing, and pause if API
access, browser authorization, or destructive confirmation is required.
```

Inside a microfeed clone, the agent should use `yarn microfeed`. The repository
also provides the canonical `manage-microfeed-content` skill at
`.agents/skills/manage-microfeed-content/`, which teaches the agent to select
commands, preserve credentials, and confirm destructive operations. The
published `@microfeed/cli` package bundles the same skill for agent hosts that
distribute skills with npm packages.

Claude Code reads the clone's `CLAUDE.md`, which imports the repository guidance
and routes content work to that skill. Other compatible coding agents can
discover the `.agents/skills/` copy directly. You do not need to install or
paste the skill into the prompt when the agent is already working inside a
microfeed clone.

## Keep browser authorization human-controlled

An agent may start `yarn microfeed login <site-url>`, but the administrator
must sign in and approve or deny permissions in the browser. The agent must not
click **Allow**, request a password, or inspect the encrypted credential store
or operating-system keychain.

Never paste an API key, OAuth access token, refresh token, or client secret
into the prompt. In CI, supply `MICROFEED_API_KEY` through the secret manager
and instruct the agent to reference the variable without reading or printing
it.

## Choose the operation that matches the request

Ask the agent to inspect current content before writing and to use structured
JSON output. Media vocabulary matters:

- an **item image** is cover art or a thumbnail;
- a **media attachment** is the item's one main file and RSS enclosure; and
- **standalone media** is an uploaded file, such as an inline rich-text image.

The agent should use `--image-file`, `--attachment-file`, or `media upload`
accordingly. It should never inspect or print a short-lived upload URL.

For deletion, the agent must report the selected saved-instance name and exact
item ID, obtain explicit approval, and then pass that same ID to `--confirm`.
The CLI deliberately has no generic yes flag.

Continue with [Manage content with `@microfeed/cli`](/automation/cli/) for the guided
human workflow and the [`@microfeed/cli` reference](/microfeed-cli/) for the
complete command and output contract.
