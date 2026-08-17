---
title: Dashboard tour
description: Learn where to publish content, edit channel details, configure settings, and reach public feeds.
---

The Admin dashboard is the private control room for one microfeed channel. Its
left navigation stays consistent while the main panel changes for each task.

![The microfeed dashboard home page with public feed links and a completed setup checklist](/images/screenshots/2-dashboard-1-home.png)

## Main areas

**Add item** opens the publishing form. Use it for a post, external URL, image,
audio, video, or document.

**See all items** lists everything in the channel. Sort the list, open a public
page, or edit an existing item.

**Edit channel** manages the channel image, title, publisher, website,
categories, language, and description.

**API** opens a dedicated area for availability, API keys, an interactive
browser explorer, and public API documentation formats.

**Webhooks** opens Overview, Endpoints, Event explorer, and Deliveries. It shows
context-aware local or deployed availability, combines configured and active
endpoint counts, and shows an owner-controlled daily delivery budget instead of
a pricing-tier limit. The Overview quickstart can scaffold or copy a complete
JavaScript or Python receiver, explain how to reveal its signing secret, and
lead directly to a signed Event Explorer test. Endpoints manages subscriptions
and signing-secret reveal or rotation; Event explorer previews exact generated
or current-content payloads; Deliveries provides attempt diagnostics, pause
recovery, and redelivery. See
[Content automation](/automation/) before connecting a deployed agent.

Plain `yarn dev` automatically supplies the local Queue simulation at no
Cloudflare cost. Preview and production show an instance-specific enable
command and explain why deployed Queue resources remain opt-in. The daily
delivery budget defaults to 1,000, can be changed immediately from 0 through
1,000,000, and is an owner cost guard rather than a microfeed plan limit.

**Settings** manages website themes and shared code, tracking URLs, subscribe
methods, site access, media storage, feed ordering, and favicon. It does not
contain the **Edit channel** form. See [Themes and website code](/dashboard/themes/)
and [Site access](/dashboard/customize/) for the two appearance and availability
workflows.

The channel control at the top of the sidebar links directly to the public
website, RSS feed, and JSON feed. The top bar also contains item search, theme,
and user menus. Select **Search** or press <kbd>Command</kbd>+<kbd>K</kbd> on a
Mac or <kbd>Ctrl</kbd>+<kbd>K</kbd> elsewhere. The dialog first shows the five
most recently updated items; type at least two characters to search titles.
[**Account settings**](/manage/domains-and-access/#change-your-built-in-login)
in the user menu manages login identity, passkeys, dashboard sessions, and
microfeed CLI computer connections. On small screens, the menu button opens
the sidebar as a drawer.

## Light and dark dashboard themes

The theme menu offers Light, Dark, and System. This changes only the Admin,
login, and password-setup experience; the public website uses the public theme
chosen under **Settings**.

Every procedure in these docs names the control to use and the result to
expect, so you can follow it without needing a screenshot.
