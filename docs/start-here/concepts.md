---
title: How microfeed works
description: Plain-language definitions for the parts of a microfeed installation.
---

microfeed is a content management system, or **CMS**. People can use a private
dashboard to publish content, while coding agents can use the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli). Visitors use
the public site or subscribe to its feeds.

You do not need to operate these Cloudflare services separately during normal
use. The clone-free `npx @microfeed/cli manage` launcher creates, connects,
updates, and checks them as one microfeed site.

## The important words

**[Cloudflare](https://www.cloudflare.com/)** provides the infrastructure that
runs microfeed. The application and its data live in your own Cloudflare
account—not on a server operated by microfeed—so you control the deployment,
stored data, and account settings.

**[Worker](https://developers.cloudflare.com/workers/)** is Cloudflare’s name
for the web application that runs microfeed. It responds when someone opens
your website, reads a feed, or uses the dashboard, without requiring you to
maintain a traditional server or operating system.

**[D1](https://developers.cloudflare.com/d1/)** is Cloudflare’s SQL database.
microfeed uses it for structured records such as channel settings, published
items, administrator configuration, and installed theme versions. Uploaded
media file bytes are stored separately.

**[R2](https://developers.cloudflare.com/r2/)** is Cloudflare’s object storage
for uploaded images, audio, video, documents, and packaged theme assets. It is
optional: a content-only installation can publish text and link to files hosted
elsewhere without enabling R2.

**Repository clone** is an optional local copy of microfeed’s source code. It
includes the project-owned `yarn manage` command for contributors and people
who prefer the manual deployment workflow. A clone is not required when using
the published management launcher.

**Instance** is the short local name that selects one saved microfeed site. The
name is not a Cloudflare login or website address. The launcher can remember
several instances without putting state in your current folder; a repository
clone keeps its own instance state instead.

**Admin dashboard** is the private management area where you create items,
upload media, and customize the channel. It is separate from the public site.

**Content CLI** is the `microfeed` command exposed by the official
`@microfeed/cli` package. After the instance owner enables API access, it lets
people or coding agents manage the same channel through browser authorization
without reading or printing the credential.

**Content automation** can use three related tools. The authenticated API reads
or changes content. Webhooks notify an external endpoint when subscribed
content changes. `@microfeed/cli` wraps API operations in task-oriented commands
that are easier for a person or local coding agent to use. See [Content
automation](/automation/) to choose the right combination.

**Headless** means using microfeed’s feeds or API while another website or app
presents the content. microfeed can hide its generated web pages without
deleting the content or structured feeds.

## One item, three outputs

When you publish an item, microfeed can expose it as:

1. A page on the public website.
2. An entry in the RSS feed at `/rss/`.
3. An entry in the JSON feed at `/json/`.

The public JSON Feed is read-only. Separately, an instance owner can enable the
authenticated API for integrations that create and manage content. See the
public microfeed.org examples: [interactive docs](https://www.microfeed.org/api/v1/),
[OpenAPI JSON](https://www.microfeed.org/api/v1/openapi.json),
[OpenAPI YAML](https://www.microfeed.org/api/v1/openapi.yaml),
[llms.txt](https://www.microfeed.org/api/v1/llms.txt), and
[llms-full.txt](https://www.microfeed.org/api/v1/llms-full.txt). Each instance
publishes the same resources under its versioned `/api/v1/` path when public
API docs are enabled.

## What the local management tool changes

`npx @microfeed/cli manage` prepares the matching microfeed release in a private
cache and runs the same guarded management engine used by `yarn manage` inside
a clone. It checks for name collisions, applies database migrations, builds the
application, deploys it, and verifies the result. Launcher connection details
live in the platform microfeed configuration directory, separate from the
replaceable source cache.

For exact behavior and safety rules, use the
[management CLI reference](/manage-cli/). Its `yarn manage` examples map to the
clone-free `npx @microfeed/cli manage` prefix.
