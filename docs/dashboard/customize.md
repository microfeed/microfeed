---
title: Themes, access, and custom code
description: Control public availability, select a theme, and make careful code-level customizations.
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

Choose a built-in theme and save it, then use the public website link to inspect
desktop and mobile layouts. The dashboard’s Light/Dark/System switch does not
change the public theme.

The custom-theme code editor is available from the theme settings when the
custom option is selected.

![Editing a custom microfeed web theme with raw HTML, CSS classes, Mustache variables, and pagination controls](/images/screenshots/4-code-editor-1.png)

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

Use `yarn manage auth <action>` from the connected repository clone to set up,
reset, change, or disable built-in login. Running `yarn manage auth` without an
action prints help and makes no change.

Optional Cloudflare Access is managed through `yarn manage access`. See
[Domains and authentication](/manage/domains-and-access/) before changing a
production dashboard.

API access has its own switches and API keys in the dashboard’s **API** area.
It is not controlled by dashboard login credentials. See
[API overview](/api/) before sharing access with an integration.
