---
title: Manage content with AI agents
description: Use experimental browser-native WebMCP for visible drafts, or give a local coding agent a broader content task through the credential-safe CLI.
---

microfeed supports two interactive agent workflows. Experimental WebMCP lets a
browser-based agent read content and help with the draft currently open in a
protected dashboard. `@microfeed/cli` gives a local coding agent the broader
API-backed workflow for drafts, media, publishing, and other content tasks.

## Use WebMCP for visible drafts

[WebMCP](https://webmachinelearning.github.io/webmcp/) is an experimental web
platform proposal. A page can expose structured JavaScript tools to an agent in
the same browser through `document.modelContext`. It is not a remote MCP server
and does not replace microfeed's API, OAuth, CLI, OpenAPI document, or
`llms.txt` files.

microfeed activates its WebMCP tools automatically only when both conditions
are true:

- the current browser provides the native `document.modelContext` API; and
- the dashboard is protected by built-in login or Cloudflare Access.

There is no microfeed setting to enable. Public themed pages do not load or run
WebMCP code. An unsupported browser performs one feature check and downloads no
WebMCP implementation or validation chunk. A supported protected dashboard
loads the small tool registry only in that browser session; the server does no
polling or background work.

The dashboard exposes tools to list and read Items and Pages, open a new Item
or Page editor, and save the visible new or unpublished editor as a draft. A
save merges only supplied editorial fields with the editor's current state and
always persists an unpublished result. The tool disappears when the visible
content is published, unlisted, deleted, or the default 404 Page. The server
rechecks stored and resulting status before accepting every WebMCP write.

WebMCP cannot publish, delete, upload media, manage Site Files or themes, read
API keys, change account settings, or configure webhooks. Use the dashboard or
the authenticated CLI/API workflow for those operations. Webhook events caused
by an accepted draft save use `context.origin: "webmcp"`, so an automation can
distinguish them from dashboard and API writes.

Because the browser API remains experimental, tool discovery currently
requires a Chrome WebMCP development or origin-trial environment. Browsers
without the native API degrade silently.

## Use the CLI for broader content tasks

Use `@microfeed/cli` when a person asks a local coding agent to work across
content, upload media, or publish. The CLI wraps the API in task-oriented
commands and keeps its browser-granted credentials opaque.

The CLI is an interactive workflow: the person supplies the task and remains
available for browser consent and destructive confirmation. A persistent
service that reacts asynchronously should instead follow [Build webhook
endpoints](/webhooks/endpoints/) and the `build-microfeed-automation` skill.

## Give the agent an outcome, not a credential

Include the site, the content outcome, and the approval boundary in the prompt:

```text
Use `npx @microfeed/cli` to create a draft item on https://feed.example.com
from article.md. Use `--json`, show me the draft before publishing, and pause
if API access, browser authorization, or destructive confirmation is required.
```

The command works from any folder. If the agent is already working inside a
Git-cloned microfeed source repository whose dependencies are installed, it
may use `yarn microfeed` as a shortcut to the local CLI version. That source
repository also provides the canonical `manage-microfeed-content` skill at
`.agents/skills/manage-microfeed-content/`, which teaches the agent to select
commands, preserve credentials, and confirm destructive operations. The
published `@microfeed/cli` package bundles the same skill for agent hosts that
distribute skills with npm packages.

Claude Code reads `CLAUDE.md` in the Git-cloned source repository, which
imports the repository guidance and routes content work to that skill. Other
compatible coding agents can discover the `.agents/skills/` copy directly.
You do not need to install or paste the skill into the prompt when the agent is
already working inside that source repository.

## Keep browser authorization human-controlled

An agent may start `npx @microfeed/cli login <site-url>`, but the administrator
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
