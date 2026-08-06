---
title: How microfeed works
description: Plain-language definitions for the parts of a microfeed installation.
---

microfeed is a content management system, or **CMS**. You use a private
dashboard to publish content, and visitors use the public site or subscribe to
its feeds.

## The important words

**Cloudflare** is the hosting provider. A microfeed deployment lives inside
your Cloudflare account, so you keep control of the site and its data.

**Worker** is Cloudflare’s name for the small web application that receives
requests and renders microfeed. It replaces a traditional web server you would
need to maintain.

**D1** is the database that stores channel settings, items, and other structured
information.

**R2** is optional media-file storage for images, audio, video, and documents.
A content-only installation can publish text and external links without R2.

**Git clone** means a local copy of this source repository. The copy includes
both microfeed and the supported `yarn manage` deployment tool.

**Instance** is the saved local connection to one microfeed site. You can keep
several instances in one clone and select them by name.

**Admin dashboard** is the private management area where you create items,
upload media, and customize the channel. It is separate from the public site.

## One item, three outputs

When you publish an item, microfeed can expose it as:

1. A page on the public website.
2. An entry in the RSS feed at `/rss/`.
3. An entry in the JSON feed at `/json/`.

The public JSON Feed is read-only. Separately, an instance owner can enable the
authenticated API for integrations that create and manage content. That API can
publish interactive docs, OpenAPI JSON and YAML, and agent-ready `llms.txt`
files under `/api/`.

## What the local management tool changes

`yarn manage` creates and updates the Cloudflare resources for your chosen
instance. It checks for name collisions, applies database migrations, builds
the application, deploys it, and verifies the result. It stores local connection
details in the repository’s ignored `.microfeed/` directory.

For exact behavior and safety rules, use the
[`yarn manage` command reference](/manage-cli/).
