# `@microfeed/cli`

Manage content on one or more [microfeed](https://www.microfeed.org/) sites
from a terminal or coding agent. The CLI uses browser-based OAuth for
interactive work and accepts an existing API key for unattended CI jobs.

## Requirements

- Node.js 22.12 or newer
- A microfeed site with API access enabled
- Built-in administrator login for browser-based OAuth

Instances without built-in login can continue using an API key.

If a content command returns `404`, the requested resource may not exist or API
access may be disabled for the selected instance.

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
Raw `--input` is UTF-8 text. Use the item command's `--attachment-file` option
for a local media attachment/RSS enclosure, or `--image-file` for cover art.

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
item-image versus media-attachment semantics, credential safety, and deletion
confirmation.

## Bugs and source

- [Report a bug](https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug)
- [Source repository](https://github.com/microfeed/microfeed)

## License

`@microfeed/cli` is licensed under the
[GNU Affero General Public License v3.0](./LICENSE), the same license as
microfeed.
