# `@microfeed/cli`

[Package on npm](https://www.npmjs.com/package/@microfeed/cli) ·
[Guided workflow](https://docs.microfeed.org/automation/cli/) ·
[`@microfeed/cli` reference](https://docs.microfeed.org/microfeed-cli/)

The official, agent-friendly command for deploying
[microfeed](https://www.microfeed.org/) and publishing content on its sites.
Use it directly from a terminal or let a local coding agent drive it. Site
deployment uses Cloudflare browser authorization; content management uses
browser authorization for interactive work and accepts an existing API key
for unattended CI jobs.

Create, read, update, and delete items; upload cover art, inline media, and RSS
enclosures; update a channel; or call any documented REST operation without
giving an agent a raw credential.

## Requirements

- Node.js 22.12 or newer
- For clone-free deployment: npm, Git, Corepack, and a Cloudflare account
- For content management: a microfeed site with API access enabled and
  built-in administrator login for browser authorization

Instances without built-in login can continue using an API key.

New microfeed instances keep API access disabled by default. The site owner
must sign in to the admin dashboard, open **API → API Settings**, and turn on
**Enable API access** before content commands can succeed. Browser login itself
can be saved while API access is off.

If a content command returns `404`, the CLI prints these steps and a link to
the [API setup guide](https://docs.microfeed.org/api/authentication/#enable-the-api).
With `--json`, the result also includes a structured `recovery` object. An AI
agent must pause and ask the owner to complete the dashboard step in the
browser; it must never request a dashboard password, API key, or CLI credential.

## Run the CLI

Inside a microfeed repository clone, the local workspace is ready after the
normal `yarn install`:

```console
yarn microfeed --help
```

In another Yarn project, install the published package locally:

```console
yarn add -D @microfeed/cli
yarn microfeed --help
```

For one-off use without installation:

```console
yarn dlx @microfeed/cli --help
```

A global installation is optional and is not required:

```console
npm install --global @microfeed/cli
microfeed --help
```

## Ask a coding agent

To deploy a new site or connect and update an existing site without cloning
the source repository yourself, give a local coding agent this prompt:

```text
Run `npx @microfeed/cli manage` and follow every instruction it prints until
`status` verifies the deployment.
```

The launcher requires npm, Git, and Corepack. It downloads the exact tagged
release matching the CLI into a private persistent cache, installs its locked
dependencies, and prints the repository-owned deployment skill and reference
for the agent. The first setup may use about 1.3 GB and take several minutes.
Every later management command uses the same prefix, such as
`npx @microfeed/cli manage status`. The source cache is replaceable; saved
deployment state is kept separately.

For content management, give an agent a content goal and the site URL instead
of a credential. For example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if API access must be
enabled, browser authorization is required, or a destructive action needs
confirmation.
```

Inside a microfeed clone, tell the agent to prefer `yarn microfeed`. Elsewhere,
it can use a project-local installation or `yarn dlx @microfeed/cli`. You—not
the agent—approve permissions in the browser.

## Site URLs and instance names

A **site URL** is the root public URL that opens a microfeed site. It may use a
custom domain or the generated `workers.dev` address:

```text
https://feed.example.com
https://my-feed.example-account.workers.dev
```

Do not include a dashboard path, query, fragment, or embedded credentials.
Local HTTP is allowed only for `localhost` and `127.0.0.1`.

An **instance name** is a local name for a saved site, such as `production` or
`personal-feed`. It is not a username, browser identity, or Wrangler profile.

A **connection name** identifies this computer on the site's **Account
settings → App access** page, such as `Home Mac` or `Work laptop`. One site can
have several microfeed CLI computer connections. The local instance name and
server-visible connection name are intentionally separate.

## Log in

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed login https://feed.example.com \
  --instance <instance-name> \
  --connection-name "Home Mac"
```

The CLI verifies the site, opens administrator login and consent in a browser,
and saves the authorized instance locally. The person operating the site must
approve or deny access in the browser. Without `--connection-name`, the CLI
uses the computer hostname or a privacy-neutral platform label. Re-login reuses
the same random connection ID for that saved site instead of creating a
duplicate computer entry.

OAuth browser authorization requires the site's built-in login. Cloudflare
Access can protect routes, but it does not create the microfeed application
session OAuth needs. If the CLI reports that authorization is unavailable,
enable built-in login from the connected repository with
`yarn manage auth setup`, then retry. New sites expose this capability in their
identity document; the CLI gives compatible guidance for older sites too.

CLI credential bundles are encrypted with AES-256-GCM. Only the encryption key is
stored in the operating-system keychain; the CLI never falls back to plaintext
credential storage.

Manage saved instances with:

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed instances list
yarn microfeed instances use <instance-name>
yarn microfeed logout --instance <instance-name>
```

Logout revokes this computer's current token family and removes the local
saved instance. The authorization remains visible as **Inactive** under
**Account settings → App access** until the owner revokes it. Owners can revoke
one computer without interrupting others, or revoke every connection for the
microfeed CLI application.

## Manage items

Use `--json` for deterministic output consumed by another program or coding
agent:

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed item list --summary --instance <instance-name> --json
yarn microfeed item search hello --fields title --instance <instance-name> --json
yarn microfeed item get 0HGJLSML3P1 --unwrap --instance <instance-name> --json
yarn microfeed item create --instance <instance-name> --input item.json --validate-only --json
yarn microfeed item create --instance <instance-name> --input item.json --idempotency-key 8ca861ab-0383-4f10-bbc2-8c80d8ef29dc --verify --json
yarn microfeed item update 0HGJLSML3P1 --instance <instance-name> --input item.json --json
yarn microfeed item update 0HGJLSML3P1 --instance <instance-name> --attachment-file ./episode.mp3 --json
yarn microfeed item update 0HGJLSML3P1 --instance <instance-name> --image-file ./cover.png --json
yarn microfeed media upload ./inline-image.png --instance <instance-name> --json
```

Create and update accept either a JSON object through `--input` or common flags
such as `--title`, `--content-html`, and `--status`. Do not mix the two input
forms.

`item list --summary` and `item get --unwrap` keep the normal response envelope
but remove feed metadata; add `--fields` to project an allowlisted set of item
fields. Summary defaults to `id,title,status,date_published,date_modified,url`
and retains feed pagination.

Use `item create --validate-only` to authenticate to the target and check its
deployed create schema without writing an item or uploading a local file. For
creation, generate one UUID per logical item, pass it with `--idempotency-key`,
and reuse that exact key and payload for every retry within 24 hours. Add
`--verify` to return an unwrapped read-back after creation and any attachment
workflow; a verification failure reports the already-created ID and exits
nonzero.

When `--input -` reads standard input, one complete root JSON object is a
frame: the command can continue without waiting for an interactive stream to
close. File input behavior is unchanged.

`item search <query>` searches item titles and stored plain-text content. Use
`--fields title` for title-only search, `--status` for comma-separated status
filters, publication-time bounds in Unix milliseconds, and `--next-cursor` for
forward pagination. Unquoted terms are ANDed, while single or double quotes
inside the query request an exact phrase. Exact matches rank before
typo-tolerant title matches.

Use `--attachment-file <path>` for the item's one main media attachment. The
CLI supports common audio, video, document, and image extensions, infers the
category and MIME type, and saves it as JSON Feed `attachments[0]` and the RSS
enclosure.

Use `--image-file <path>` for local AVIF, GIF, JPEG, PNG, or WebP cover art or
a thumbnail. Use `--image <url>` only when cover art is already hosted at an
absolute URL. The item image and media attachment are independent fields.

The CLI never prints the short-lived upload URL or sends its Bearer credential
with file bytes.

For an image embedded inside `content_html`, upload it as standalone media:

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed media upload ./diagram.png --instance <instance-name> --json
```

Read the permanent `media_url` from the JSON result, insert it into an `<img
src>` in the item HTML, and save the item with `--input`. This command does not
edit the item. Images need no item ID; audio, video, and documents require
`--item-id <item-id>`. The CLI never returns the short-lived presigned URL.

Item deletion requires an interactive exact-ID confirmation. For reviewed
automation, pass the same ID to `--confirm`:

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed item delete 0HGJLSML3P1 \
  --instance <instance-name> \
  --confirm 0HGJLSML3P1 \
  --json
```

There is no generic `--yes` option.

## Develop webhook receivers

Create a complete local JavaScript receiver without contacting a site:

```console
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language javascript
```

The generated server will provide `http://127.0.0.1:3000/webhook` after it
starts. Next, create that URL under **Admin → Webhooks → Endpoints**, reveal its
`whsec_…` value from **Signing secret** as `MICROFEED_WEBHOOK_SECRET`, then
install and run the receiver. Send an Event Explorer test only after the
receiver is listening.

Add `--language python` for Flask. The starter binds only
`http://127.0.0.1:3000/webhook`, verifies exact raw bytes with the maintained
Standard Webhooks library, displays delivery/event/test/duplicate details, and
prevents signed test events from producing production effects. It is a local
inspector with in-memory duplicate tracking, not a production queue.

Use the tools for distinct jobs:

- `webhook scaffold` creates a receiver project offline.
- `webhook listen` verifies, displays, and optionally forwards signed
  deliveries. Add `--tunnel` to receive a deployed site's test through a
  temporary Cloudflare Quick Tunnel.
- `webhook sample <event>` reads one exact unsigned example from an instance's
  generated OpenAPI contract.
- Admin Event Explorer sends a real signed, budgeted, retryable test.

Every endpoint receives one unique `whsec_…` signing secret. Store it only in
`MICROFEED_WEBHOOK_SECRET`. The Standard Webhooks signature authenticates
microfeed and detects tampering; no additional passcode or URL credential is
needed.

For a deployed site, run `yarn microfeed webhook listen --tunnel`. If
`cloudflared` is missing, the interactive command offers to download a pinned
official binary into a versioned microfeed cache and verifies its SHA-256
digest. It installs nothing system-wide. Register the printed temporary HTTPS
`/webhook` URL, paste the endpoint secret into the visible prompt, and stop
the listener after the Event Explorer test.

Within a microfeed clone, `.microfeed/webhooks/<endpoint-name>/` is the
recommended development location. The clone ignores `.microfeed/`, so local
receiver code and secrets are not accidentally committed to microfeed. Move a
hardened receiver into its own repository when it becomes a deployed service.
The root `yarn microfeed` command resolves relative scaffold paths from the Yarn
project root, so this directory is created beside the root `package.json`, not
inside `packages/cli`.

## Call the REST API

The raw API command accepts only relative `/api/v1/…` paths:

```console
# Replace <instance-name> with a saved instance name.
yarn microfeed api GET "/api/v1/feed/?limit=3" \
  --instance <instance-name> \
  --json
```

The CLI selects and refreshes credentials internally. It blocks
caller-provided `Authorization`, `Cookie`, and `Host` headers and refuses
redirects so credentials are never forwarded to another site.
Raw `--input` is UTF-8 text. Use `media upload` for inline or standalone media,
`--attachment-file` for a local media attachment/RSS enclosure, or
`--image-file` for cover art.

## Use an API key in CI

Supply credentials through the CI secret manager. `MICROFEED_API_KEY` takes
precedence over saved browser credentials and is never persisted. Identify the
target with a saved instance or `MICROFEED_URL`:

```console
MICROFEED_URL=https://feed.example.com yarn microfeed item list --json
```

Never put an API key or CLI credential in a command, checked-in file, log,
generated example, or agent conversation.

## Command help and documentation

Every command and nested subcommand supports `-h` and `--help`:

```console
yarn microfeed login --help
yarn microfeed instances use -h
yarn microfeed item search --help
yarn microfeed item create --help
yarn microfeed help item delete
yarn microfeed media upload --help
yarn microfeed api --help
```

Read the complete [`@microfeed/cli` reference](https://docs.microfeed.org/microfeed-cli/)
for every command, option, output contract, and safety rule.

## Agent skill

A microfeed clone routes coding agents to the repository-owned
`manage-microfeed-content` skill under `.agents/skills/`. Claude Code enters
through the root `CLAUDE.md` bridge; compatible agent hosts can discover the
skill directly. The npm package also includes the same skill at
`dist/skills/manage-microfeed-content/` so agent hosts and skill installers can
distribute it together with the CLI. The skill teaches site and instance
vocabulary, browser-consent handoff, deterministic output, standalone-media
versus item-image versus media-attachment semantics, credential safety, and
deletion confirmation.

## Bugs and source

- [Report a bug](https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug)
- [Source repository](https://github.com/microfeed/microfeed)

## License

`@microfeed/cli` is licensed under the
[GNU Affero General Public License v3.0](./LICENSE), the same license as
microfeed.
