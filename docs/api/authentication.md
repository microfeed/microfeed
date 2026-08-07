---
title: Bearer authentication
description: Enable the microfeed API, create a named API key, and send it in the Authorization Bearer header.
---

Every direct REST API request uses a named API key in the standard
`Authorization: Bearer` header. The API is disabled by default on a new
instance, so an administrator must enable it before an integration can connect.
Never use a Cloudflare token or dashboard password as an API credential.

## Enable the API

1. Sign in to the microfeed dashboard.
2. Select **API** in the main navigation.
3. Open **API Settings**.
4. Turn on **Enable API access**.
5. Optionally turn on **Publish API docs** if people or agents should be able to
   open the generated documentation formats without a credential.

The switches save immediately. Turning API access off also unpublishes the API
docs and makes `/api/v1/*` routes return not found. Existing API keys remain in
the database but cannot be used until access is deliberately re-enabled.

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

## Send a Bearer request

Store the named API key in your secret manager and expose it to the process as
`MICROFEED_API_KEY`. Replace `https://feed.example.com` with the root URL of
your microfeed site:

```console
curl --request GET \
  --url "https://feed.example.com/api/v1/feed/?limit=3" \
  --header "Authorization: Bearer ${MICROFEED_API_KEY}"
```

The credential belongs in the header, not the URL or request body. A successful
request returns JSON using the response shape documented by that instance's
OpenAPI contract.

## Rename, rotate, or revoke an API key

**Rename** changes the dashboard label but not the credential.

**Rotate** replaces the secret immediately. Update the integration with the new
value before its next request; the old value stops working at once.

**Revoke** permanently removes the key and cannot be undone. Use it when an
integration is retired or a credential may have leaked.

## Verify access

Open **API → API Overview** and select a key in a generated example, or use
**API Explorer**. A valid request returns its documented success response. A
missing, malformed, revoked, or otherwise invalid Bearer credential returns
401. A disabled API returns 404 so the endpoint is not advertised publicly.
