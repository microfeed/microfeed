---
title: Connect an AI app with MCP
description: Enable an OAuth-protected MCP server and let desktop or hosted AI apps manage your microfeed content.
---

Connect a desktop or hosted AI app to your microfeed using its own MCP server.
The app can read content and, with your permission, create, publish, update,
and delete it. You sign in through your browser; you do not give the app your
password or copy an API key.

## Enable the server

1. Sign in to your microfeed dashboard with built-in administrator login.
2. Open **MCP Server** in the main navigation, between **API** and **Webhooks**.
3. Turn on **Enable MCP server** and copy the **Server URL**.

The URL is `https://<instance-domain>/mcp/`. For example, an instance at
`https://feed.example.com` uses `https://feed.example.com/mcp/`.
The form without the final slash also works without a redirect.

MCP starts disabled and has its own switch. REST API access and public API docs
can remain disabled while MCP is enabled. Built-in administrator login is
required. An instance relying only on Cloudflare Access cannot enable this
OAuth server.

If an older instance already uses `mcp` as its administrator path or a Page
URL, change that path before enabling MCP. Existing content is not renamed or
deleted automatically.

## Connect your app

1. In an app supporting OAuth MCP connections, add a remote server using the
   copied URL and **Streamable HTTP** transport.
2. Complete the sign-in page opened in your browser.
3. Check the instance address, app name, and requested permissions, then
   choose **Allow** or **Deny**.
4. Ask the app to list available tools or read your content to verify the
   connection.

The server supports automatic OAuth dynamic client registration, authorization
code grants with PKCE S256, and rotating refresh tokens. The app must support
those capabilities. Client names are supplied by the connecting app; review
the requested access before approving it.

This release supports desktop and hosted connections. Direct requests from
apps running on another browser origin are blocked.

New connections request `content:read` and `content:write` by default so the app
can create items after you approve. An app can explicitly request read-only
access. For refresh tokens, also request `offline_access` in the app's OAuth
settings. If an existing connection was registered with only read access,
create a new connection with read and write scopes; existing grants are not
expanded automatically. In ChatGPT or Codex's custom MCP dialog, use
**Advanced OAuth settings** to set the default scopes to
`content:read content:write offline_access` before creating the connection.

## Available operations and permissions

The tools cover the existing content API: feed reads, search, items, Pages,
tags, channel updates, podcast chapter reads, media preparation, and Site Files.
Site File tools include draft editing, validation, preview, publishing, reset,
and deletion. Tool names use snake case, such as `get_item`, `create_page`,
`search_content`, and `publish_site_file`.

Tools accept the API's path and query parameters directly. Mutation bodies go
under `input`. For example, `create_item` accepts:

```json
{
  "input": {
    "title": "An unpublished draft",
    "content_text": "Review this before publishing.",
    "status": "unpublished"
  },
  "idempotencyKey": "draft-for-my-next-episode"
}
```

- `content:read` permits content reads and search.
- `content:write` permits mutations and the API's POST validation/preview
  operations. Write access includes publishing and deletion.
- `offline_access`, when requested and approved, lets the app refresh its
  connection without another sign-in until that authorization expires or is
  revoked.

Publishing defaults match the API. Request `status: "unpublished"` when you
want a draft. Tool results contain structured JSON and a text representation.
Mutations preserve API idempotency and webhook behavior; emitted events use
`context.origin: "mcp"`. The optional `automationContext` argument accepts
the API's `Microfeed-Correlation-Id` and `Microfeed-Causation-Id` fields.

Media tools prepare an upload and return `presigned_url` and `media_url`. The
app uploads the file bytes separately with HTTP PUT to the temporary upload
URL, then uses the permanent `media_url` in item content, cover art, or the
main attachment. File bytes are not sent through MCP JSON messages.

## Revoke access or disconnect

Open **Account settings → App access** to review and revoke an app's grant.
Revocation immediately invalidates its access and refresh tokens. You can
also disable the MCP server to block all MCP requests and new authorizations;
this does not revoke saved grants or change REST availability.

If a connection fails, check that MCP is enabled, built-in sign-in is
available, and the app supports OAuth discovery and dynamic registration.
Missing or expired tokens receive HTTP 401. Insufficient tool permissions
receive HTTP 403 and identify the scope to request. A disabled server returns
HTTP 404. After revocation, connect again and approve a fresh grant.

## Discovery and other agent workflows

The unauthenticated MCP response advertises its OAuth metadata using
`WWW-Authenticate`. Protected-resource metadata is available at
`/.well-known/oauth-protected-resource` and its `/mcp` path variant while MCP
is enabled. The canonical OAuth resource is the complete `/mcp/` URL. API keys
and tokens issued for the REST API are not accepted by MCP.

Remote MCP is separate from experimental [dashboard WebMCP tools](../ai-agents/#use-webmcp-for-visible-drafts),
which operate on visible drafts in a compatible signed-in browser. Use
[@microfeed/cli](../cli/) for a local coding agent's command-line workflow, or
[the REST API](/api/) for direct HTTP integrations.
