---
title: Site access
description: Choose whether your website and public feeds are available, headless, or offline.
---

Open **Settings → Access control** to choose how people and software can reach
your published content. Selecting a mode saves immediately; it does not delete
content or change individual item visibility.

Choose **Public** for a normal website, **Headless** when another app presents
your feeds or API content, and **Offline** for a temporary public shutdown.

## Compare access modes

| Mode | What remains available | Use it when |
| --- | --- | --- |
| **Public** | Website pages, `sitemap.xml`, RSS, JSON Feed, media, and any separately enabled APIs | You want the normal public website and feeds. |
| **Headless** | RSS, JSON Feed, media, and any separately enabled APIs; website pages and `sitemap.xml` return 404 | Another website or app presents content from your feeds or API. |
| **Offline** | The protected dashboard and separately enabled authenticated APIs; public website pages, RSS, and JSON Feed return 404 | You need to take public publishing offline without deleting content. |

## Public

Public is the normal publishing mode. The website home page, item pages, RSS
feed, JSON Feed, and sitemap can all be opened without signing in. Individual
draft or hidden items still follow their own visibility rules.

## Headless

Headless mode hides microfeed's generated website while leaving structured
feeds, APIs, and media available. Requests for the website home page, item web
pages, and `sitemap.xml` return 404. RSS and JSON item endpoints remain
available, including their normal web-link metadata, so existing integrations
do not need a different feed shape.

Use this mode when a separate frontend reads microfeed's JSON Feed or API. The
separate frontend is not created or hosted by this setting.

## Offline

Offline mode makes public website pages, RSS, and JSON Feed return 404. The
protected dashboard remains available so an administrator can edit content and
switch access back to Public or Headless later. Separately enabled authenticated
APIs continue to follow their own API availability and credential settings.

## Verify a change

After selecting a mode, open the public home page, `/rss/`, `/json/`, and
`/sitemap.xml` in a private browser window. Confirm that each route is available
or returns 404 as described above. If the result is unexpected, return to
**Settings → Access control**, select the intended mode again, and check the
visibility of the affected item.

Site access does not protect the dashboard or grant API credentials. See
[Domains and authentication](/manage/domains-and-access/) for dashboard login
and [API overview](/api/) for authenticated integrations.
