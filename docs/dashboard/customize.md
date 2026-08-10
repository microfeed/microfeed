---
title: Themes, access, and custom code
description: Control public availability and make careful code-level customizations.
---

These settings change the public site. Preview the result before sharing a new
design or access policy broadly.

## Access control

**Public** makes non-admin web pages and the RSS and JSON feeds available.
**Headless** keeps RSS, JSON Feed, authenticated APIs, and media available while
returning not-found responses for the website home page, item pages, and
sitemap. **Offline** returns not-found responses for public routes while
keeping the protected dashboard and separately configured authenticated API
available.

This channel setting is different from dashboard authentication. Built-in login
and optional Cloudflare Access protect the admin area itself.

## Public theme

Use **Settings → Themes** to install, customize, preview, publish, activate, and
roll back immutable theme versions. The dashboard’s Light/Dark/System switch
does not change the public theme. See [Versioned themes](/dashboard/themes/)
for the Admin draft workflow and the standalone authoring kit.

When an older installation upgrades, its selected custom theme is copied into
the versioned theme list as **Legacy theme**. The original custom-code data is
retained unchanged for application rollback, but current releases no longer
expose the old theme editor or use that data as a rendering fallback.

## Custom code

Custom code can add markup, CSS, or supported integration snippets to the public
site. Treat it like source code:

1. Save the current version outside the dashboard before a large change.
2. Change one concern at a time.
3. Check public pages at mobile and desktop widths.
4. Remove the change if it interferes with navigation, readability, or feed
   metadata.

Never paste private keys, Cloudflare tokens, dashboard credentials, or other
secrets into public custom code. Anything sent to a browser can be inspected by
a visitor.

## Dashboard authentication

For routine email and password changes, open the avatar menu and select
[**Account settings**](/manage/domains-and-access/#change-your-built-in-login).
Use `yarn manage auth <action>` from the connected repository clone for initial
setup, forgotten-password recovery, dashboard-path changes, or disabling the
built-in login. Running `yarn manage auth` without an action prints help and
makes no change.

Optional Cloudflare Access is managed through `yarn manage access`. See
[Domains and authentication](/manage/domains-and-access/) before changing a
production dashboard.

API access has its own switches and API keys in the dashboard’s **API** area.
It is not controlled by dashboard login credentials. See
[API overview](/api/) before sharing access with an integration.
