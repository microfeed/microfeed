---
title: Glossary
description: Short definitions for microfeed, Cloudflare, publishing, and deployment terms.
---

**Admin dashboard**
The private site-management area where an editor publishes items and changes
channel settings.

**API Explorer**
The dashboard page that renders the generated API contract and can send test
requests with a selected API key. The selected key stays in memory and is not
stored by the explorer.

**API key**
A secret credential created for one integration. Send it as a Bearer credential
to enabled [`/api/v1/` operations](https://www.microfeed.org/api/v1/). Use a
separate named key for each integration so it can be rotated or revoked
independently.

**Bearer authentication**
An API authentication method in which a request carries a secret credential in
its `Authorization` header. Whoever holds the credential can use its access.

**Channel**
The collection identity shared by a public website, RSS feed, and JSON Feed.

**Cloudflare**
The hosting provider whose account owns a deployed microfeed Worker and its
data resources.

**Cloudflare Access**
An optional identity layer that can sit in front of the Admin dashboard.

**D1**
Cloudflare’s SQL database. microfeed stores channel settings, items, and other
structured data in D1.

**Deployment**
The process of checking, building, uploading, and verifying a version of
microfeed in Cloudflare.

**Feed**
An ordered collection of published items. microfeed presents the collection as
Web pages, RSS, and JSON.

**Headless**
A publishing mode in which software consumes RSS, JSON Feed, or the API while a
different website or app presents the content. microfeed can hide its generated
web pages without deleting the content.

**Git clone**
A local copy of this repository containing the source code and `yarn manage`
tool.

**Instance**
The locally saved connection to one production, preview, or local microfeed
site.

**Item**
One published unit, such as a post, link, image, audio episode, video, or
document.

**OpenAPI**
A machine-readable description of an HTTP API. When an instance owner enables
API access and public API docs, microfeed generates OpenAPI 3.1 JSON and YAML
from the same typed contract used by its interactive documentation.

**R2**
Cloudflare object storage used by microfeed for uploaded media files. It is
optional for content made only of text and external URLs.

**Snapshot**
A portable archive containing D1 schema and data, R2 objects, checksums, and
migration history for one site.

**Theme version**
One immutable release of a public-site design. Editing creates a draft and then
a new installed version; it never changes an existing installed version in
place.

**Worker**
The Cloudflare application that handles HTTP requests and runs microfeed
without a traditional server.

**Wrangler**
Cloudflare’s command-line tool. microfeed invokes it behind the supported
`yarn manage` interface; people and agents should not replace management
workflows with improvised Wrangler commands.

**workers.dev address**
The free Cloudflare-provided web address for a Worker. A microfeed site can use
it directly or attach a custom domain later.
