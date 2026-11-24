---
title: Edit visible drafts with WebMCP
description: Let a compatible browser agent read content and edit the visible unpublished draft in your protected microfeed dashboard.
---

Use WebMCP when an AI agent is helping inside your browser. It can read
content, open an editor, and save the new or unpublished draft currently
visible in your dashboard. You review and publish the result yourself.

[WebMCP](https://webmachinelearning.github.io/webmcp/) is an experimental web
platform proposal. A page exposes structured tools through the browser's
native `document.modelContext` API. The remote [MCP server](/automation/mcp/)
provides a separate connection for AI assistants outside the dashboard.

## Open a compatible dashboard

microfeed activates its WebMCP tools automatically when both conditions are
true:

- The browser provides the native `document.modelContext` API.
- The dashboard is protected by built-in login or Cloudflare Access.

There is no microfeed switch to enable. Tool discovery currently requires a
Chrome WebMCP development or origin-trial environment. Browsers without the
native API continue to use the dashboard normally.

## Work on a draft

1. Sign in to your dashboard in the compatible browser.
2. Open a new item or Page, or an existing unpublished draft.
3. Ask your browser agent to edit the visible draft and save it.
4. Review the saved content in the editor. Select **Published** yourself when
   you are ready to make it public.

For example:

```text
Improve the introduction in the draft open in this microfeed dashboard.
Save the changes as an unpublished draft so I can review them.
```

## Available tools and limits

The tools can list and read Items and Pages, open a new Item or Page editor,
and save the visible new or unpublished editor as a draft. A save merges only
supplied editorial fields with the editor's current state and always
persists an unpublished result.

The save tool disappears when the visible content is published, unlisted,
deleted, or the default 404 Page. The server rechecks stored and resulting
status before accepting every WebMCP write.

WebMCP cannot publish, delete, upload media, manage Site Files or themes, read
API keys, change account settings, or configure webhooks. Use the
[Admin UI](/dashboard/), [CLI](/automation/cli/), or [MCP server](/automation/mcp/)
for broader content tasks. Site administration stays in the dashboard or
[management CLI](/manage-cli/).

## How it runs

Public themed pages do not load or run WebMCP code. An unsupported browser
performs one feature check and downloads no WebMCP implementation or
validation chunk. A supported protected dashboard loads the small tool
registry only in that browser session; the server does no polling or
background work.

Webhook events caused by an accepted draft save use
`context.origin: "webmcp"`, so an automation can distinguish them from
dashboard, API, CLI, and remote MCP writes.
