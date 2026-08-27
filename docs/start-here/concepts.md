---
title: How microfeed works
description: Plain-language definitions for the parts of a microfeed installation.
---

microfeed is a content management system, or **CMS**. People can use a private
dashboard to publish content, while coding agents can use the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli). Visitors use
the public site or subscribe to its feeds.

You do not need to operate these Cloudflare services separately during normal
use. Run `npx @microfeed/cli manage` from any folder to create, connect, update,
and check them as one microfeed site without first Git-cloning microfeed's
source repository yourself.

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

**Git-cloned microfeed source repository** is an optional local copy created
with `git clone https://github.com/microfeed/microfeed.git`. After its
dependencies are installed, it provides `yarn manage` and `yarn microfeed` as
shortcuts to the repository's local CLI versions. You do not need this source
repository when using the published `npx` commands.

**Instance** is the short local name that selects one saved microfeed site. The
name is not a Cloudflare login or website address. The launcher can remember
several instances without putting state in your current folder; a Git-cloned
microfeed source repository keeps its own instance state instead.

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

`npx @microfeed/cli manage` verifies and copies its bundled microfeed release
into a private cache, then runs the same guarded management engine available
through `yarn manage` inside a Git-cloned microfeed source repository. It
checks for name collisions, applies database migrations, builds the
application, deploys it, and verifies the result. Launcher connection details
live in the platform microfeed configuration directory, separate from the
replaceable source cache.

For exact behavior and safety rules, use the
[management CLI reference](/manage-cli/). Its examples use the recommended
`npx @microfeed/cli manage` prefix.
