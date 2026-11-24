---
title: Manage content with AI agents
description: Connect an AI app over MCP, use the content CLI from a coding agent, or edit visible drafts with experimental dashboard WebMCP.
---

microfeed has four [ways to manage content](/content-management/).
Choose the connection that fits where you or your agent work.

| Workflow | Start here |
| --- | --- |
| Work directly in a visual editor | Use the [Admin UI](/dashboard/). |
| Give a coding agent a task in a local terminal | [Use the content CLI](../cli/) with browser-authorized access. |
| Help with the draft visible in a compatible browser | Use experimental [WebMCP](#use-webmcp-for-visible-drafts). |
| Ask an AI assistant to find content, create drafts, or publish | [Connect it to your site's remote MCP server](../mcp/). |

## Use the CLI from a terminal

Use `@microfeed/cli` when a person asks a local coding agent to work across
content, upload media, or publish. The CLI wraps the API in task-oriented
commands and keeps its browser-granted credentials opaque.

The CLI is an interactive workflow: the person supplies the task and remains
available for browser consent and destructive confirmation. A persistent
service that reacts asynchronously should instead follow [Build webhook
endpoints](/webhooks/endpoints/) and the `build-microfeed-automation` skill.

### Give the agent an outcome, not a credential

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

### Keep browser authorization human-controlled

An agent may start `npx @microfeed/cli login <site-url>`, but the administrator
must sign in and approve or deny permissions in the browser. The agent must not
click **Allow**, request a password, or inspect the encrypted credential store
or operating-system keychain.

Never paste an API key, OAuth access token, refresh token, or client secret
into the prompt. In CI, supply `MICROFEED_API_KEY` through the secret manager
and instruct the agent to reference the variable without reading or printing
it.

### Choose the operation that matches the request

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

## Use WebMCP for visible drafts

A compatible browser agent can discover tools in your signed-in, protected
dashboard to read Items and Pages, open an editor, and save the visible new
or unpublished draft. Publishing, deletion, media uploads, and Site File
management require another content workflow.

Follow [Edit visible drafts with WebMCP](/content-management/webmcp/) for
browser requirements, tool limits, and how draft saves run.

## Connect an AI app with MCP

Each instance includes a remote MCP server using Streamable HTTP and OAuth.
Enable **MCP Server** in your dashboard, then add your site's `/mcp/` URL to
a compatible AI assistant such as ChatGPT, Claude, Gemini, or Codex. Sign in
to microfeed in the browser and approve the requested permissions.

With read and write access, the assistant can work with items, Pages, tags,
channel details, media preparation, and Site Files. Select the connected
integration in your chat and give it a concrete task:

```text
Find my three most recent items about gardening. Use them to suggest a follow-up
post, then save my chosen idea as an unpublished draft. Return the saved item ID
and ask before publishing.
```

Review the draft in **See all items**. Follow the [MCP connection guide](../mcp/)
for setup, scopes, media uploads, revocation, and repeated reconnect prompts.
