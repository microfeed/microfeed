---
title: Enable access and create API keys
description: Turn on the microfeed API, create a separate named key for each integration, and rotate or revoke it safely.
---

The API is disabled by default on a new instance. An administrator enables it
from the dashboard; no Cloudflare token or dashboard password belongs in an
integration.

## Enable the API

1. Sign in to the microfeed dashboard.
2. Select **API** in the main navigation.
3. Open **API Settings**.
4. Turn on **Enable API access**.
5. Optionally turn on **Publish API docs** if people or agents should be able to
   open the generated documentation formats without an API key.

The switches save immediately. Turning API access off also unpublishes the API
docs and makes `/api/*` routes return not found. Existing keys remain in the
database so they can work again if access is deliberately re-enabled.

## Create a named API key

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

## Rename, rotate, or revoke

**Rename** changes the dashboard label but not the credential.

**Rotate** replaces the secret immediately. Update the integration with the new
value before its next request; the old value stops working at once.

**Revoke** permanently removes the key and cannot be undone. Use it when an
integration is retired or a credential may have leaked.

## Verify access

Open **API → API Overview** and select a key in a generated example, or use
**API Explorer**. A valid request returns its documented success response. A
missing or invalid key returns 401. A disabled API returns 404 so the endpoint
is not advertised publicly.
