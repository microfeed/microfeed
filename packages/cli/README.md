# `@microfeed/cli`

[Package on npm](https://www.npmjs.com/package/@microfeed/cli) ·
[Guided workflow](https://docs.microfeed.org/api/cli/) ·
[Complete command reference](https://docs.microfeed.org/microfeed-cli/)

The official, agent-friendly command for publishing and managing content on
one or more [microfeed](https://www.microfeed.org/) sites. Use it directly from
a terminal or let a local coding agent drive it. The CLI uses browser-based
OAuth for interactive work and accepts an existing API key for unattended CI
jobs.

Create, read, update, and delete items; upload cover art, inline media, and RSS
enclosures; update a channel; or call any documented REST operation without
giving an agent a raw OAuth token.

## Requirements

- Node.js 22.12 or newer
- A microfeed site with API access enabled
- Built-in administrator login for browser-based OAuth

Instances without built-in login can continue using an API key.

New microfeed instances keep API access disabled by default. The site owner
must sign in to the admin dashboard, open **API → API Settings**, and turn on
**Enable API access** before content commands can succeed. OAuth login itself
can be saved while API access is off.

If a content command returns `404`, the CLI prints these steps and a link to
the [API setup guide](https://docs.microfeed.org/api/authentication/#enable-the-api).
With `--json`, the result also includes a structured `recovery` object. An AI
agent must pause and ask the owner to complete the dashboard step in the
browser; it must never request a dashboard password, API key, or OAuth token.

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

A global installation is optional and is not required.

## Ask a coding agent

Give an agent a content goal and the site URL instead of a credential. For
example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if API access must be
enabled, browser authorization is required, or a destructive action needs
confirmation.
```

Inside a microfeed clone, tell the agent to prefer `yarn microfeed`. Elsewhere,
it can use a project-local installation or `yarn dlx @microfeed/cli`. You—not
the agent—approve OAuth permissions in the browser.

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
`personal-feed`. It is not a username, OAuth identity, or Wrangler profile.

## Log in

```console
yarn microfeed login https://feed.example.com --instance production
```

The CLI verifies the site, opens administrator login and consent in a browser,
and saves the authorized instance locally. The person operating the site must
approve or deny access in the browser.

OAuth token bundles are encrypted with AES-256-GCM. Only the encryption key is
stored in the operating-system keychain; the CLI never falls back to plaintext
credential storage.

Manage saved instances with:

```console
yarn microfeed instances list
yarn microfeed instances use production
yarn microfeed logout --instance production
```

## Manage items

Use `--json` for deterministic output consumed by another program or coding
agent:

```console
yarn microfeed item list --instance production --json
yarn microfeed item get 0HGJLSML3P1 --instance production --json
yarn microfeed item create --instance production --input item.json --json
yarn microfeed item update 0HGJLSML3P1 --instance production --input item.json --json
yarn microfeed item update 0HGJLSML3P1 --instance production --attachment-file ./episode.mp3 --json
yarn microfeed item update 0HGJLSML3P1 --instance production --image-file ./cover.png --json
yarn microfeed media upload ./inline-image.png --instance production --json
```

Create and update accept either a JSON object through `--input` or common flags
such as `--title`, `--content-html`, and `--status`. Do not mix the two input
forms.

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
yarn microfeed media upload ./diagram.png --instance production --json
```

Read the permanent `media_url` from the JSON result, insert it into an `<img
src>` in the item HTML, and save the item with `--input`. This command does not
edit the item. Images need no item ID; audio, video, and documents require
`--item-id <item-id>`. The CLI never returns the short-lived presigned URL.

Item deletion requires an interactive exact-ID confirmation. For reviewed
automation, pass the same ID to `--confirm`:

```console
yarn microfeed item delete 0HGJLSML3P1 \
  --instance production \
  --confirm 0HGJLSML3P1 \
  --json
```

There is no generic `--yes` option.

## Call the REST API

The raw API command accepts only relative `/api/v1/…` paths:

```console
yarn microfeed api GET "/api/v1/feed/?limit=3" \
  --instance production \
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
precedence over saved OAuth credentials and is never persisted. Identify the
target with a saved instance or `MICROFEED_URL`:

```console
MICROFEED_URL=https://feed.example.com yarn microfeed item list --json
```

Never put an API key or OAuth token in a command, checked-in file, log,
generated example, or agent conversation.

## Command help and documentation

Every command and nested subcommand supports `-h` and `--help`:

```console
yarn microfeed login --help
yarn microfeed instances use -h
yarn microfeed item create --help
yarn microfeed help item delete
yarn microfeed media upload --help
yarn microfeed api --help
```

Read the complete [`yarn microfeed` command reference](https://docs.microfeed.org/microfeed-cli/)
for every command, option, output contract, and safety rule.

## Agent skill

A microfeed clone exposes the repository-owned `manage-microfeed-content`
skill automatically from `.agents/skills/`. The npm package also includes the
same skill at `dist/skills/manage-microfeed-content/` so agent hosts and skill
installers can distribute it together with the CLI. The skill teaches site and
instance vocabulary, browser-consent handoff, deterministic output,
standalone-media versus item-image versus media-attachment semantics,
credential safety, and deletion confirmation.

## Bugs and source

- [Report a bug](https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug)
- [Source repository](https://github.com/microfeed/microfeed)

## License

`@microfeed/cli` is licensed under the
[GNU Affero General Public License v3.0](./LICENSE), the same license as
microfeed.
