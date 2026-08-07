---
title: Authentication and OAuth
description: Turn on the microfeed API, authorize the microfeed CLI with OAuth, or create a named API key for unattended integrations.
---

The API is disabled by default on a new instance. An administrator enables it
from the dashboard; no Cloudflare token or dashboard password belongs in an
integration. The recommended choice for a person or local coding agent is
OAuth through the microfeed CLI. API keys remain available for CI and existing
integrations.

## Enable the API

1. Sign in to the microfeed dashboard.
2. Select **API** in the main navigation.
3. Open **API Settings**.
4. Turn on **Enable API access**.
5. Optionally turn on **Publish API docs** if people or agents should be able to
   open the generated documentation formats without a credential.

The switches save immediately. Turning API access off also unpublishes the API
docs and makes `/api/v1/*` routes return not found. Existing API keys and OAuth
grants remain in the database but are suspended until access is deliberately
re-enabled.

## Authorize the microfeed CLI with OAuth

OAuth is available when the instance uses the built-in administrator email and
password login. From a microfeed repository clone, run:

```console
yarn microfeed login https://feed.example.com
```

The command verifies the instance and opens its permission page in your
browser. Sign in yourself, review the requested permissions, and select
**Allow** or **Deny**. The CLI receives a one-hour access token and, when
`offline_access` is approved, a rotating refresh token valid for up to 30
days. The REST API still receives a Bearer credential; OAuth makes that
credential short-lived, scoped, and revocable instead of removing
authentication.

The CLI encrypts its token bundle with AES-256-GCM. Only the encryption key is
stored in the operating system keychain. If the keychain is unavailable, login
stops and does not fall back to a plaintext credential file.

Review or revoke access under **API → OAuth Apps**. Deleting a registered app
or revoking an authorized application invalidates its tokens immediately.
Resetting the owner password or disabling built-in login revokes all owner
OAuth credentials.

OAuth permissions are:

| Scope | Access |
| --- | --- |
| `content:read` | Read feeds and items. |
| `content:write` | Create, update, and delete items; update the channel; prepare media uploads. |
| `offline_access` | Obtain a rotating refresh token. |

The permission screen calls out that write access includes deletion.

Standard OAuth discovery is public so compatible clients can find the
authorization and token endpoints. It exposes protocol capabilities and scope
names only—not the administrator email, Cloudflare account, instance data, API
keys, client secrets, or tokens. The existing microfeed identity document is
unchanged.

## Create a named API key

Use an API key for unattended environments that cannot complete browser
authorization, or for an existing integration that already supports it.

1. Open **API → API Authentication**.
2. Select **Create API key**.
3. Enter a name that identifies one integration, such as “Publishing
   automation” or “Mobile app.”
4. Create the key, then copy it into that integration’s secret storage.

Use a different key for every integration. That lets you stop one client
without interrupting the others.

Send the key in the standard Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

Never place an API key in a URL, public custom code, issue report, screenshot,
Git commit, or agent prompt. Treat it like a password.

## Rename, rotate, or revoke an API key

**Rename** changes the dashboard label but not the credential.

**Rotate** replaces the secret immediately. Update the integration with the new
value before its next request; the old value stops working at once.

**Revoke** permanently removes the key and cannot be undone. Use it when an
integration is retired or a credential may have leaked.

## Verify access

Open **API → API Overview** and select a key in a generated example, or use
**API Explorer**. A valid request returns its documented success response. A
missing or invalid credential returns 401. An OAuth token without the required
scope returns `403 insufficient_scope`. A disabled API returns 404 so the
endpoint is not advertised publicly.
