---
title: Connect an AI app with MCP
description: Connect AI assistants such as ChatGPT, Claude, Gemini, and Codex to your instance's remote MCP server over Streamable HTTP with OAuth authentication.
---

Every microfeed instance includes a remote MCP server for compatible AI
assistants such as ChatGPT, Claude, Gemini, and Codex. It uses **Streamable
HTTP** with **OAuth authentication**. Enable it, connect your assistant, then
ask it to find content, turn notes into a draft, or update an existing item.

MCP stands for **Model Context Protocol**. It gives the assistant named tools
for working with your site. You sign in through your browser and approve the
access it requests.

Your server URL is `https://<instance-domain>/mcp/`. For a site at
`https://feed.example.com`, use `https://feed.example.com/mcp/`.

## Enable the server

1. Sign in to your microfeed dashboard with built-in administrator login.
2. Open **MCP Server** in the main navigation, between **API** and **Webhooks**.
3. Turn on **Enable MCP server** and copy the **Server URL**.

If **MCP Server** is missing, [update your site](/manage/update/) first. If the
switch asks for built-in sign-in, follow [Enable built-in
login](/manage/domains-and-access/#enable-built-in-login), create your password
in the browser, and return to the dashboard. Cloudflare Access can also
protect the dashboard, but MCP requires built-in login for OAuth authorization.

MCP starts disabled and has its own switch. REST API access and public API docs
have separate settings, so you can use MCP while REST access is disabled.

An older site may already use `mcp` as its administrator path or a Page URL.
The dashboard explains which conflict to resolve before enabling the server.
Change that path explicitly, then try the switch again.

## Connect your app

Choose an app that supports remote MCP over **Streamable HTTP** and OAuth
dynamic client registration, sometimes labeled **DCR** or **automatic client
registration**.

1. Add a custom MCP server in the app and paste your copied server URL.
2. Choose **OAuth** authentication and automatic client registration if the
   app asks how to register.
3. Review the requested scopes. New connections request read and write access
   by default. Also request `offline_access` if you want the app to refresh
   its connection when the access token expires.
4. Sign in to your microfeed in the browser. Check the site address, app name,
   and permissions, then choose **Allow** or **Deny**.
5. Select the connected integration in your chat and try the draft example
   below.

Client names are supplied by the connecting app. Review each request before
approving it, and keep your password in the microfeed sign-in page.

### ChatGPT and Codex

In the **Plugins** interface, select the plus button, then **Add custom MCP
server**. Give the connection a name that identifies your site and paste the
URL under **Server URL**. Choose **OAuth**. In **Advanced OAuth settings**,
use dynamic client registration and set the default scopes to
`content:read content:write offline_access` for content editing with refresh
access.

After creating and connecting the plugin, select it with `@` in a chat.
Keep one clearly named connection for each intended permission set so the
agent uses the grant you approved. OpenAI's [connection
guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) covers
the current interface and workspace requirements.

### Try an unpublished draft

Select your microfeed integration and send a prompt such as:

```text
Create an unpublished draft titled "My next post" from the notes below.
Use the connected microfeed tools to save it and return its item ID.
Ask before publishing or deleting anything.
```

Add your notes to the prompt. Open **See all items** in the dashboard and
check that the returned item exists with **Unpublished** status. Text written
in a chat becomes a saved microfeed draft only after a creation tool succeeds.

Write permission includes publishing and deletion. Ask for an unpublished
draft whenever you want to review the content first. The `create_item` tool
uses the API's publishing default, which creates a published item when
`status` is omitted.

## Permissions and connection lifetime

| Scope | What it permits |
| --- | --- |
| `content:read` | Read and search content, including items, Pages, tags, and Site Files. |
| `content:write` | Create, update, publish, and delete content, update channel details, prepare media uploads, and run validation or preview tools. |
| `offline_access` | Let the app obtain a refresh token and renew access without another sign-in while that authorization remains valid. |

An app can explicitly request read-only access. Every tool checks its own
required content scope. Review the permissions on the consent screen before
choosing **Allow**.

Access tokens last one hour. Apps that request `offline_access` and support
refresh tokens can renew access for up to 30 days. Revoking the app or
disabling the server blocks its access immediately.

To upgrade an existing read-only connection, create a fresh connection with
read and write scopes and approve it in the browser. Select that connection
in your chat and remove the stale duplicate from your app. Existing grants
retain the permissions you originally approved.

## Work with media

Media uploads require [enabled media storage](/dashboard/media-and-feeds/)
and an app that can upload file bytes over HTTP. Tell the app whether a file
is an inline image, item cover art, or the item's main media attachment.

The `prepare_media_upload` tool returns a temporary upload URL and a permanent
`media_url`. The app uploads the bytes to the temporary URL using HTTP PUT,
then uses `media_url` in the item. Ask the app to return the permanent media
address when you need a link. Files hosted elsewhere can be referenced by
their existing URLs.

## Revoke access or disable MCP

Open **Account settings → App access** to review connected apps and revoke
an app's grant. Revocation immediately invalidates its access and refresh
tokens. To connect again, approve a fresh authorization in the browser.

Turn off **MCP Server → Enable MCP server** to block all MCP requests and
new MCP authorizations. Saved grants remain available if you enable the
server again. Use **App access** when you also want to revoke those grants.

## Troubleshoot a connection

| What you see | What to check |
| --- | --- |
| The MCP switch is unavailable | Set up built-in administrator login, or resolve the Page or administrator-path conflict shown by the dashboard. |
| HTTP 404 at the server URL | Check that MCP is enabled on the correct instance and built-in sign-in is available. |
| Reads work, but writes repeatedly ask to reconnect | Check the grant's scopes in **App access**. Create a fresh read/write connection, select it in the chat, and remove stale read-only duplicates from the app. |
| The app asks to sign in after an hour | Request `offline_access` during connection setup and check that the app supports refresh tokens. |
| HTTP 401 after revocation or expiry | Sign in and approve a fresh authorization. |
| HTTP 403 for a tool | Check that the selected connection has the content scope required by that tool. |
| The app cannot add a localhost URL | Use a client running on the same computer, or configure the hosted app's supported tunnel connection. |

If prompts repeat every few seconds, check the selected connection and its
scopes first. A read-only grant cannot run write tools, including
`validate_item`. Repeatedly approving the same read-only connection keeps it
read-only.

### Local testing and browser apps

A client running on your computer can reach a local microfeed at an address
such as `http://localhost:4321/mcp/`. Hosted clients need a reachable HTTPS
endpoint or a supported tunnel. In ChatGPT's custom MCP dialog, **Tunnel**
uses OpenAI's [Secure MCP
Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

Direct MCP requests from apps on another browser origin are blocked. Use a
desktop client or an app whose backend makes the MCP requests.

## Tool and protocol reference

The tools cover feed reads and search; item and Page creation, reading,
updates, deletion, and validation; tag management; channel updates; media
preparation; podcast chapter reads; and Site Files. Site File tools include
draft editing, validation, preview, publishing, reset, and deletion.

Tool names use snake case, such as `get_item`, `create_page`, `search_content`,
and `publish_site_file`. Ask your app to list the available tools for your
installed microfeed version.

Tools accept the API's path and query parameters directly. Mutation bodies go
under `input`. For example, `create_item` accepts:

```json
{
  "input": {
    "title": "An unpublished draft",
    "content_text": "Review this before publishing.",
    "status": "unpublished"
  },
  "idempotencyKey": "draft-for-my-next-post"
}
```

Choose a unique `idempotencyKey` for each new item, then reuse it with the same
creation input when retrying that logical action. Results contain structured
JSON and a text representation.
Mutations preserve API webhook behavior and emit `context.origin: "mcp"`.
The optional `automationContext` argument accepts the API's
`Microfeed-Correlation-Id` and `Microfeed-Causation-Id` fields.

The server supports OAuth authorization code grants with PKCE S256, dynamic
client registration, and rotating refresh tokens. Its unauthenticated HTTP
401 challenge advertises protected-resource metadata through
`WWW-Authenticate`. That metadata is available at
`/.well-known/oauth-protected-resource` and its `/mcp` path variant while MCP
is enabled. The canonical OAuth resource is the complete `/mcp/` URL. The
form without the final slash is also served directly. MCP requires an OAuth
token issued for this resource. API keys and CLI access tokens cannot be used
as MCP credentials.

## Other agent workflows

Use [dashboard WebMCP tools](/content-management/webmcp/) to work with a
visible draft in a compatible signed-in browser. Use
[@microfeed/cli](../cli/) for terminal commands, or [the REST API](/api/)
for direct HTTP integrations. The [content management overview](/content-management/)
compares the Admin UI, CLI, WebMCP, and MCP server. Use the
[automation overview](../) for webhooks and workflows that react to changes.
