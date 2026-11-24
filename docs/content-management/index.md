---
title: Choose how to manage content
description: Manage your microfeed through the Admin UI, CLI, WebMCP, or remote MCP server.
---

You can manage the same microfeed content in four ways. Choose the interface
that fits your task and where you want to work.

| Workflow | Use it for | How you connect |
| --- | --- | --- |
| **[Admin UI](/dashboard/)** | Create and edit content yourself, upload media, review drafts, and publish in a visual dashboard. | Open your site's dashboard and sign in. |
| **[CLI](/automation/cli/)** | Run content commands from a terminal or give a local coding agent a repeatable task. | Enable API access, then authorize the official `@microfeed/cli` in your browser. |
| **[WebMCP](./webmcp/)** | Let a compatible browser agent read content and help with the new or unpublished draft visible in your dashboard. | Open a protected dashboard in a browser with native WebMCP support. |
| **[MCP server](/automation/mcp/)** | Let an AI assistant search, create, edit, publish, or delete content through remote tools. | Enable MCP, add your site's `/mcp/` URL to the assistant, then sign in and approve OAuth permissions. |

## Admin UI

Use the dashboard when you want to work directly with your content. Its forms
support items, Pages, tags, channel details, media uploads, and Site Files.
You can review an unpublished draft before making it public.

Start with the [dashboard tour](/dashboard/) and [Create and edit
items](/dashboard/publish/).

## CLI

The official `@microfeed/cli` provides content commands for people and local
coding agents. Run `npx @microfeed/cli` from any folder. You authorize access
in the browser; the CLI stores and refreshes its credentials.

Start with [Manage content with the microfeed CLI](/automation/cli/).

## WebMCP

WebMCP is an experimental browser capability. A compatible agent works with
the signed-in dashboard and can save the visible new or unpublished editor
as a draft. Publishing, deletion, and media uploads require another workflow.

Start with [Edit visible drafts with WebMCP](./webmcp/) for browser
requirements and the available tools.

## MCP server

Every microfeed instance includes an optional remote MCP server. Compatible
AI assistants such as ChatGPT, Claude, Gemini, and Codex connect over
**Streamable HTTP** and use **OAuth** for authentication. You sign in through
your browser and approve read-only or read/write access.

The server starts disabled. Once enabled, its address is
`https://<instance-domain>/mcp/`. It works independently of REST API access.

Start with [Connect an AI app with MCP](/automation/mcp/) for setup,
permissions, media preparation, and revocation.

## Review a draft before publishing

Whichever workflow you choose, ask for or select **Unpublished** while
preparing content. Open **See all items** in the dashboard to verify that the
draft was saved, review it, then publish when ready. MCP write permission
includes publishing and deletion, so make your intended status explicit when
giving an assistant a task.

For scheduled imports, integrations, or services that react to changes, see
the [API overview](/api/) and [Content automation](/automation/).
