---
title: Status and troubleshooting
description: Diagnose account, deployment, media, login, and public-feed problems without risking content.
---

Start with the read-only status report:

```console
yarn manage status
```

For a multi-site clone, add the exact `--instance <name>`.

## The wrong Cloudflare account appears

Run `yarn manage accounts`. If you intentionally need another named Wrangler
login, select or create it with `--profile <name>`; use `--reauthorize` only
when you deliberately want fresh browser authorization. If several accounts
are listed, choose by name and full ID rather than position.

## A Worker already uses the requested name

Initialization will not overwrite an unknown Worker. If it is an existing
microfeed site, use the printed `yarn manage connect --worker ... --instance ...`
command. Otherwise choose a different, distinctive project name.

## A new Cloudflare account cannot serve workers.dev yet

Cloudflare may take a few minutes to prepare the first Workers subdomain. Wait,
then rerun the same `yarn manage init` command. Saved progress resumes the
unfinished work.

## Media upload is unavailable

Check whether the status report says R2 is ready, pending, or deliberately
disabled. Cloudflare may require R2 activation in the correct account. Once it
is available, use `yarn manage deploy --enable-r2`; do not create an unrelated
bucket by hand.

## The dashboard login does not work

Confirm the dashboard path and authentication state in the status report. Use
`yarn manage auth reset-password` for built-in login. If Cloudflare Access is
also enabled, test each layer and logout flow in a private browser window.

## The dashboard saves, but public content is missing

Check the channel’s Access control setting, the item’s visibility, and the exact
public hostname. Then inspect `/`, `/rss/`, and `/json/`. An offline channel
intentionally returns not-found responses for all non-admin routes.

## API routes return 404 or 401

A 404 usually means API access is disabled, or public API docs are not
published for a documentation URL. Check **API → API Settings** in the
dashboard. A 401 on an integration endpoint means the request did not send a
currently active API key as `Authorization: Bearer <api-key>`. If a key was
rotated or revoked, update the integration immediately.

## Before reporting a bug

Include the failing command, non-secret error text, operating system, and
microfeed source commit. Remove emails, account IDs, private dashboard URLs,
tokens, and content that should not be public.
