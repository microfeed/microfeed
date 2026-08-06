---
title: Domains and authentication
description: Add a custom hostname and protect the admin dashboard with built-in login or Cloudflare Access.
---

The public hostname and dashboard authentication solve different problems. A
custom domain gives the site a memorable address. Authentication protects who
can open the admin dashboard.

## Add or inspect a custom domain

From the connected clone, run:

```console
yarn manage domain
```

Follow the prompts for the exact saved instance and hostname. The command
checks the relationship between the Worker, Cloudflare zone, and desired route.
If Cloudflare still needs DNS or certificate time, wait and run the command
again rather than creating unrelated records by guesswork.

Afterward, open the public site, RSS feed, JSON feed, and dashboard at the new
hostname.

## Built-in login

Built-in login stores an administrator email and password verifier in the
microfeed database. Always include an action:

```console
yarn manage auth setup
yarn manage auth reset-password
yarn manage auth change-email
yarn manage auth change-path
yarn manage auth disable
```

Running `yarn manage auth` by itself only prints help. Password creation and
reset use a private browser page; do not paste the password or private URL into
the terminal or a conversation.

## Optional Cloudflare Access

Cloudflare Access can add an outer identity layer in front of the dashboard:

```console
yarn manage access
```

The dashboard can have built-in login, Access, or both. When both are enabled,
sign-out clears the built-in session and routes through the Cloudflare Access
logout flow.

:::caution
Do not disable the final authentication layer on a public production dashboard
unless you deliberately accept that anyone who finds its address can manage the
site.
:::

Verify with `yarn manage status`, then test sign-in and sign-out in a private
browser window.
