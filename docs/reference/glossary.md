---
title: Glossary
description: Short definitions for microfeed, Cloudflare, publishing, and deployment terms.
---

**`@microfeed/cli`**
The official content-management CLI. It wraps the authenticated API in
task-oriented commands for people and local coding agents, using browser
authorization instead of exposing an API key to the operator.

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

**Cloudflare Queue**
The optional, explicitly enabled service microfeed uses to dispatch webhook
delivery IDs outside the content request. Production and preview use isolated,
instance-specific Queue resources. Infrastructure disabling pauses and detaches
the Queue without deleting it, so later enablement can reuse the same identity
and encryption secret. Plain local development automatically uses Wrangler's
simulation and creates no Cloudflare resource or charge.

**Correlation ID**
An identifier shared across related events and API actions. An automation
preserves it so operators can follow an end-to-end workflow.

**Causation ID**
The event or action that directly caused another change. Webhook-driven automation
propagate it on API writes to detect and stop feedback loops.

**D1**
Cloudflare’s SQL database. microfeed stores channel settings, items, and other
structured data in D1.

**Daily delivery budget**
An owner-controlled webhook cost guard that limits new delivery reservations in
one UTC day. It defaults to 1,000 and can be changed from 0 through 1,000,000 in
Admin without redeploying. It is not a microfeed pricing tier or a Cloudflare
account quota; retries add Queue operations without reserving another delivery.

**Deployment**
The process of checking, building, uploading, and verifying a version of
microfeed in Cloudflare.

**Feed**
An ordered collection of published items. microfeed presents the collection as
Web pages, RSS, and JSON.

**Event Explorer**
The read-only Admin webhook contract browser. It previews exact generated or
current-content event bodies, schemas, and headers; can print a preview only in
local development; and can send one signed, budgeted test delivery to a chosen
endpoint.

**Headless**
A publishing mode in which software consumes RSS, JSON Feed, or the API while a
different website or app presents the content. microfeed can hide its generated
web pages without deleting the content.

**Git-cloned microfeed source repository**
An optional local copy of microfeed's source code created with `git clone
https://github.com/microfeed/microfeed.git`. After dependencies are installed,
it provides `yarn manage` and `yarn microfeed` as shortcuts to the source
repository's local CLI versions. The recommended published commands do not
require this source repository.

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

**Page**
A standalone, theme-rendered document such as an About, Contact, or Resources
page. Pages have their own visibility and can appear in site navigation.

**R2**
Cloudflare object storage used by microfeed for uploaded media files. It is
optional for content made only of text and external URLs.

**Snapshot**
A portable archive containing D1 schema and data, R2 objects, checksums, and
migration history for one site.

**Site File**
An owner-managed public file served at a stable site path, such as
`robots.txt`, `favicon.ico`, or an app-association document.

**Standard Webhooks**
The interoperable signing convention microfeed uses for webhook IDs,
timestamps, signatures, secret format, and exact-body verification.

**Theme version**
One immutable release of a public-site design. Editing creates a draft and then
a new installed version; it never changes an existing installed version in
place.

**Worker**
The Cloudflare application that handles HTTP requests and runs microfeed
without a traditional server.

**Webhook**
A signed HTTP notification that announces a versioned microfeed event. A
webhook is not an API credential or a trusted instruction. Receivers verify raw
bytes, deduplicate delivery IDs, durably accept work, and then apply their own
policy.

**Webhook delivery**
One event sent to one endpoint, including its attempts, response diagnostics,
status, and suppression outcome. A manual redelivery keeps the original event
body and ID but receives a new delivery ID.

**Webhook endpoint**
An administrator-configured HTTPS receiver URL, event subscription, and unique
signing secret. Local development also permits the documented loopback URL.

**Webhook signing secret**
The unique encrypted `whsec_…` value for a webhook endpoint. An administrator
can reveal it from the endpoint's **Signing secret** dialog or rotate it; after
rotation, the previous value remains valid for 24 hours. A receiver stores the
current value as `MICROFEED_WEBHOOK_SECRET` and uses it to verify the Standard
Webhooks ID, timestamp, signature, and exact body. That verification
authenticates microfeed and detects tampering; an additional passcode, bearer
token, URL credential, or custom header is unnecessary.

**Webhook test event**
A signed webhook envelope with `test: true`. Event Explorer can use any real
event type for a test, while `webhook.test` checks connectivity. Receivers trust
the body flag only after signature verification and prevent every test from
producing production side effects.

**Wrangler**
Cloudflare’s command-line tool. microfeed invokes it behind
`npx @microfeed/cli manage`, or behind `yarn manage` inside a Git-cloned
microfeed source repository; people and agents should not replace management
workflows with improvised Wrangler commands.

**workers.dev address**
The free Cloudflare-provided web address for a Worker. A microfeed site can use
it directly or attach a custom domain later.
