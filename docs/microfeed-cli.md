---
title: "@microfeed/cli reference"
description: Canonical commands, options, authentication behavior, output, and safety rules for @microfeed/cli.
---

This is the canonical capability reference for the official
[`@microfeed/cli` package](https://www.npmjs.com/package/@microfeed/cli),
including its content commands and `manage` launcher. For a shorter workflow,
start with [Manage content with the microfeed CLI](/automation/cli/).

This page is intentionally exhaustive. You do not need to read it from top to
bottom before publishing; use the contents list or built-in `--help` to jump to
the command you need.

## Contents

- [Run the CLI](#run-the-cli)
- [Deploy or administer a site](#deploy-or-administer-a-site)
- [Agent skill](#agent-skill)
- [Authentication and safety](#authentication-and-safety)
- [Command summary](#command-summary)
- [Global options](#global-options)
- [`manage`](#npx-microfeedcli-manage)
- [`login`](#npx-microfeedcli-login)
- [`logout`](#npx-microfeedcli-logout)
- [`instances`](#npx-microfeedcli-instances)
- [`item`](#npx-microfeedcli-item)
- [`item list`](#npx-microfeedcli-item-list)
- [`item search`](#npx-microfeedcli-item-search)
- [`item get`](#npx-microfeedcli-item-get)
- [`item create`](#npx-microfeedcli-item-create)
- [`item update`](#npx-microfeedcli-item-update)
- [`item delete`](#npx-microfeedcli-item-delete)
- [`media`](#npx-microfeedcli-media)
- [`media upload`](#npx-microfeedcli-media-upload)
- [`webhook`](#npx-microfeedcli-webhook)
- [`webhook scaffold`](#npx-microfeedcli-webhook-scaffold)
- [`webhook listen`](#npx-microfeedcli-webhook-listen)
- [`webhook sample`](#npx-microfeedcli-webhook-sample)
- [`api`](#npx-microfeedcli-api)
- [Output and errors](#output-and-errors)
- [Saved instances and credentials](#saved-instances-and-credentials)
- [Environment variables](#environment-variables)
- [Built-in help](#built-in-help)

## Run the CLI

`@microfeed/cli` requires Node.js 22.12 or newer. The recommended invocation
works from any folder and does not require global installation or a copy of
microfeed's source code.

| Context | Command | Installation behavior |
| --- | --- | --- |
| Recommended from any folder | `npx @microfeed/cli …` | Downloads the package when needed and reuses npm's cache. |
| Git-cloned microfeed source repository after `yarn install` | `yarn microfeed …` | Shortcut to that source repository's local CLI version. |
| Global installation | `npm install --global @microfeed/cli`, then `microfeed …` | Installs one shared executable for regular use across directories. |

The examples below use the recommended `npx @microfeed/cli` prefix. If you are
already working in a Git-cloned microfeed source repository whose dependencies
are installed, you may replace it with `yarn microfeed` to test that local
version.

## Deploy or administer a site

Ask a local coding agent to run the published launcher from any folder; you do
not need to Git-clone or open the microfeed source repository:

```console
npx @microfeed/cli manage
```

The launcher also requires Git and Corepack. It downloads the exact tagged
microfeed release matching the CLI into a persistent private cache, verifies
the checkout, installs its locked dependencies, and prints the exact
deployment skill and management-reference paths for the agent. It does not
write source files into the current project. The initial workspace may use
about 1.3 GB and take several minutes to prepare; later commands reuse it.

Pass any repository management command and options after `manage`; arguments
such as `--instance` and `--json` are forwarded unchanged:

```console
npx @microfeed/cli manage accounts --json
npx @microfeed/cli manage deploy --instance <instance-name>
npx @microfeed/cli manage status --instance <instance-name>
```

Saved deployment state is stored separately from the replaceable source cache.
The [management CLI reference](/manage-cli/) documents every forwarded command,
side effect, confirmation, and recovery path.

To install the command globally and confirm it is available:

```console
npm install --global @microfeed/cli
microfeed --help
```

Modern Yarn does not provide the older `yarn global add` workflow. Prefer a
project-local dependency when a repository should pin the CLI version; use the
global installation when you want the same command available across unrelated
directories.

## Agent skill

Inside a Git-cloned microfeed source repository, repository guidance routes
coding agents to the canonical `manage-microfeed-content` skill at
`.agents/skills/manage-microfeed-content/`. Claude Code enters through the
root `CLAUDE.md` bridge; compatible agent hosts can discover the skill directly.
The published npm tarball contains the identical skill at
`dist/skills/manage-microfeed-content/` for agent hosts or skill installers
that distribute skills with the CLI. The repository copy is canonical, and
the package check fails when the bundled copy differs.

The skill teaches invocation selection, site and instance vocabulary,
connection identity, browser-consent handoff, deterministic output, the difference between
standalone media, item images, and media attachments, credential safety, and
deletion confirmation.

## Authentication and safety

The CLI uses browser authorization for interactive work and an existing API
key for unattended work. Both result in a Bearer credential; browser login
does not make the API credential-free.

Browser login:

1. Verifies `/.well-known/microfeed.json` identifies the target as microfeed.
2. Loads the official CLI authorization endpoints from the same site URL.
3. Rejects redirects or authorization endpoints hosted at another site.
4. Opens administrator login and consent in the browser.
5. Uses authorization-code flow, S256 PKCE, and state validation.
6. Listens for the callback only at `http://127.0.0.1:8977/callback`.
7. Requests `content:read`, `content:write`, and `offline_access`.

The person operating the instance must approve or deny access in the browser.
A coding agent may start login, but must pause for that user-controlled step.
Login requires HTTPS except for `http://localhost` and `http://127.0.0.1` test
instances. If a site's public URL changes, log in again.

Browser authorization requires the site's built-in login. Cloudflare Access
can protect dashboard routes, but it does not create the microfeed application
session required by OAuth. When the identity document reports that OAuth
authorization is unavailable, the CLI tells the site owner to enable built-in
login with `npx @microfeed/cli manage auth setup`. Older sites without this
identity capability receive compatible setup guidance instead of an ambiguous
discovery error.

New instances keep API access disabled by default. Browser login can be saved
while access is off, but content commands return `404` until the site owner
signs in to the admin dashboard, opens **API → API Settings**, and turns on
**Enable API access**. An AI agent must pause for this browser-only change and
must not request the owner's dashboard password, API key, or CLI credential.

For every authenticated REST request, the CLI:

- injects the selected Bearer credential and refreshes CLI credentials when
  needed;
- accepts only the selected site URL;
- does not follow redirects or forward credentials through one;
- never prints access tokens, refresh tokens, API keys, or client secrets.

## Command summary

| Command | Purpose | Local or remote change |
| --- | --- | --- |
| `manage [command]` | Prepare a private deployment workspace, print the coding-agent handoff, or forward a management command without requiring the source repository in the current folder. | The bare command updates only the private cache. Forwarded commands retain the effects and safeguards documented in the [management CLI reference](/manage-cli/). |
| `login <site-url>` | Authorize the official public CLI client in a browser and save an instance for this computer connection. | Creates or replaces a local encrypted saved instance after browser consent. |
| `logout` | Revoke this computer's selected credential family and remove its saved instance locally. | Leaves the server-side connection listed as Inactive until the owner revokes it. |
| `instances list` | List saved instances and the current selection. | Read-only. |
| `instances use <name>` | Select the default saved instance. | Changes only the local current-instance pointer. |
| `instances remove <name>` | Remove a saved instance locally without contacting the site. | Changes only the local instance store. |
| `item list` | Read a page of the feed. | Read-only. |
| `item search <query>` | Search item and Page titles or stored plain-text content. | Read-only. |
| `item get <item-id>` | Read one item. | Read-only. |
| `item create` | Create an item from flags or JSON. | Creates remote content. |
| `item update <item-id>` | Update an item from flags or JSON. | Changes remote content. |
| `item delete <item-id>` | Delete an item after exact-ID confirmation. | Permanently deletes remote content. |
| `media upload <file>` | Upload standalone media for rich content or later API use. | Creates a remote media object but does not edit an item. |
| `webhook scaffold <directory>` | Copy a runnable JavaScript or Python webhook inspector project. | Creates one new local directory; works offline and never installs, starts, or authenticates anything. |
| `webhook listen` | Verify, display, and optionally forward webhook deliveries. | Starts a loopback listener and, with explicit `--tunnel`, a temporary public Quick Tunnel; never creates a microfeed endpoint or hosted relay. |
| `webhook sample <event>` | Read one exact event example from the selected instance's OpenAPI contract. | Read-only; does not authenticate or change the instance. |
| `api <method> <path>` | Call a relative `/api/v1/…` REST endpoint. | Depends on the method and endpoint. |

## Global options

Global options may appear before or after a command and its arguments.

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Use a saved instance instead of the current one. This takes precedence over `MICROFEED_INSTANCE`. |
| `--json` | Write deterministic JSON to standard output. API responses include `status`, `ok`, safe response `headers`, and `body`; a `404` also includes safe `recovery` guidance. |
| `-h`, `--help` | Show help for the selected command or subcommand without running it. |

When `MICROFEED_API_KEY` is set, `--instance` selects its site URL from a saved
instance; it does not cause the saved browser credential to be used.

## `npx @microfeed/cli manage`

Deploy and administer microfeed through the published launcher. See the
[management CLI reference](/manage-cli/) for every command, option, side
effect, and safety contract.

## `npx @microfeed/cli login`

**Purpose:** Verify and authorize a microfeed site, then save it as the current
instance.

**Changes:** After browser approval, creates or replaces a local encrypted
saved instance and makes it current. It does not expose a credential in terminal
output.

```console
npx @microfeed/cli login <site-url> [--instance <name>] [--connection-name <computer-name>]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Save the site under this local instance name. Names contain 1–64 letters, numbers, dots, underscores, or hyphens. |
| `--connection-name <computer-name>` | Label this computer under **Account settings → App access**. Names contain 1–64 printable characters. Without it, the CLI uses the computer hostname or a privacy-neutral platform label. |

Without `--instance`, the CLI derives the name from the site hostname.
Use the URL that opens the public microfeed site. It may use a custom domain or
the generated `workers.dev` address; do not use a dashboard path such as
`https://feed.example.com/admin`.
Login requests the official `microfeed-cli` public client with the fixed
loopback callback. The callback port must be available, and browser approval
must complete within five minutes.

The site must have built-in login enabled for browser authorization. Cloudflare
Access is compatible as an outer route protection layer, but it is not a
microfeed login session and cannot complete OAuth by itself. If built-in login
is disabled, run `npx @microfeed/cli manage auth setup`, select or connect the
intended site, then retry login. The CLI reads `oauthAuthorizationAvailable`
from newer identity documents and provides the same fallback guidance for
older sites that do not publish the field.

The CLI generates a random, non-secret connection ID for each saved site and
stores it separately from the encrypted token bundle. Logging the same saved
site in again reuses that connection ID, replaces the old token family, and
updates the connection name without creating a duplicate computer entry.

Login may succeed while API access is disabled. Before running a content
command on a new instance, the site owner signs in to the admin dashboard,
opens **API → API Settings**, and turns on **Enable API access**. If an agent is
operating the CLI, it pauses and asks the owner to complete that browser step.

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli login https://feed.example.com \
  --instance <instance-name> \
  --connection-name "Home Mac"
```

With `--json`, success returns the saved `name`, canonical `siteUrl`, verified
`instanceId`, and non-secret `connectionName`. It never returns the connection
ID or a credential.

## `npx @microfeed/cli logout`

**Purpose:** Revoke this computer's selected credential family and remove its
saved instance locally.

**Changes:** Attempts to revoke the refresh token, or the access token when no
refresh token exists, then deletes the saved instance locally. If it was
current, the alphabetically first remaining instance becomes current.

```console
npx @microfeed/cli logout [--instance <name>]
```

If revocation cannot be delivered, logout still removes the saved instance.
The server-side authorization remains visible as **Inactive** under **Account
settings → App access** until the owner revokes it. An owner can revoke one
computer connection without interrupting another, or revoke all microfeed CLI
connections together.

Use `instances remove` instead when local credentials are unreadable or when
you intentionally want a local-only removal.

## `npx @microfeed/cli instances`

Manage locally saved instances.

## `npx @microfeed/cli instances list`

**Purpose:** List instance names, site URLs, instance IDs in JSON output, and
the current selection.

**Changes:** None.

```console
npx @microfeed/cli instances list [--json]
```

Human-readable output marks the current instance with `*`. JSON output returns
an `instances` array whose entries contain `name`, `siteUrl`, `instanceId`,
`connectionName`, and `current`.

## `npx @microfeed/cli instances use`

**Purpose:** Select the default saved instance for later commands.

**Changes:** Updates only the local current-instance pointer.

```console
npx @microfeed/cli instances use <name> [--json]
```

## `npx @microfeed/cli instances remove`

**Purpose:** Remove a saved instance locally without decrypting or revoking its
CLI credentials.

**Changes:** Deletes the saved instance locally. It does not contact the site.

```console
npx @microfeed/cli instances remove <name> [--json]
```

Use `logout` for the normal revoke-and-remove workflow. Use `remove` for local
cleanup or recovery when the keychain entry is unavailable.

## `npx @microfeed/cli item`

List, search, read, create, update, or delete content items. An `<item-id>` is
the stable ID returned by `item list`, `item search`, or `item get`, such as
`0HGJLSML3P1`.
Create and update accept either common flags or one JSON object from `--input`;
they reject mixed input forms. Delete is permanent and requires an exact
item-ID confirmation.

```console
npx @microfeed/cli item <list|search|get|create|update|delete> [arguments] [options]
```

## `npx @microfeed/cli item list`

**Purpose:** Read a page from `GET /api/v1/feed/`.

**Changes:** None.

```console
npx @microfeed/cli item list [options]
```

| Option | Meaning |
| --- | --- |
| `--limit <1-300>` | Maximum number of items to return. |
| `--next-cursor <cursor>` | Continue forward from a response cursor. |
| `--prev-cursor <cursor>` | Continue backward from a response cursor. |
| `--sort <field>` | Use `created_at`, `updated_at`, `published_at`, `newest_first`, or `oldest_first`. |
| `--order <direction>` | Use `asc` or `desc`. |
| `--summary` | Preserve the response envelope but return only compact items plus `next_url` and `prev_url` pagination when present. |
| `--fields <fields>` | With `--summary`, select comma-separated projected fields. Defaults to `id,title,status,date_published,date_modified,url`. |

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item list --instance <instance-name> --limit 25 --json

npx @microfeed/cli item list --instance <instance-name> \
  --summary \
  --fields id,title,status \
  --json
```

Allowed projected fields are `id`, `title`, `status`, `date_published`,
`date_modified`, `url`, `image`, `content_text`, `content_html`, and
`attachments`. Unknown fields are rejected, and `--fields` requires
`--summary`. Compact output normalizes `status` from either the top-level item
field or `_microfeed.status`; it omits channel metadata and unrequested item
content while retaining pagination.

## `npx @microfeed/cli item search`

**Purpose:** Search items and Pages through `GET /api/v1/search/`.

**Changes:** None.

```console
npx @microfeed/cli item search <query> [options]
```

The query contains 1–200 characters. Unquoted terms use implicit AND matching,
and the final unquoted term supports prefix matching. Put matching single or
double quotes inside the query for an exact phrase. Exact matches rank before
typo-tolerant title matches; quoted phrases and content are never fuzzy
matched.

| Option | Meaning |
| --- | --- |
| `--types <types>` | Search `items`, `pages`, or `items,pages`. The default remains `items` for compatibility. |
| `--fields <fields>` | Search `title`, `content`, or `title,content`. The default searches both. |
| `--status <statuses>` | Filter by a comma-separated list of `published`, `unlisted`, or `unpublished`. The default includes all three. |
| `--date-published-ms-gt <milliseconds>` | Return items published strictly after this Unix timestamp in milliseconds. |
| `--date-published-ms-lt <milliseconds>` | Return items published strictly before this Unix timestamp in milliseconds. |
| `--limit <1-100>` | Maximum matches to return; defaults to 20. |
| `--next-cursor <cursor>` | Continue forward using a cursor returned for the same query and filters. |

Search only titles for `hello`:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item search hello --fields title --instance <instance-name> --json
```

Search both items and Pages:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item search hello --types items,pages --instance <instance-name> --json
```

Keep the shell's outer quotes separate from the exact phrase quotes that the
search API receives:

```console
npx @microfeed/cli item search '"season finale"' \
  --fields title,content \
  --status published,unlisted \
  --json
```

Without `--json`, the response body is formatted on standard output. With
`--json`, the normal CLI API envelope contains the search response under
`body`, including `items`, safe highlight segments, and an optional
`next_cursor`.

## `npx @microfeed/cli item get`

**Purpose:** Read one item by ID or an item-page slug ending in its ID.

**Changes:** None.

```console
npx @microfeed/cli item get <item-id> [--unwrap] [--fields <fields>]
```

| Option | Meaning |
| --- | --- |
| `--unwrap` | Preserve the response envelope but replace the one-item feed body with the item itself. |
| `--fields <fields>` | With `--unwrap`, select comma-separated projected fields from the same allowlist used by `item list --summary`. |

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item get 0HGJLSML3P1 --instance <instance-name> --json

npx @microfeed/cli item get 0HGJLSML3P1 \
  --unwrap \
  --fields id,title,status \
  --instance <instance-name> \
  --json
```

Unknown fields are rejected, and `--fields` requires `--unwrap`. Without the
new flags, the existing one-item feed response is unchanged.

## Item input

`item create` and `item update` accept either common flags or one JSON object.
Do not combine the two input forms.

| Common flag | API field | Meaning |
| --- | --- | --- |
| `--title <text>` | `title` | Item title. |
| `--content-html <html>` | `content_html` | HTML body. |
| `--date-published <datetime>` | `date_published` | ISO 8601 publication date and time. |
| `--attachment-file <path>` | `attachments[0]` | Upload one local main media attachment, which becomes the JSON Feed attachment and RSS enclosure. Do not combine with `--input`. |
| `--image <url>` | `image` | An already-hosted absolute item cover-image URL. This is not a local file path or media attachment. |
| `--image-file <path>` | `image` | Upload one local AVIF, GIF, JPEG, PNG, or WebP cover image. This is not the media attachment. Do not combine with `--image` or `--input`. |
| `--status <status>` | `status` | Prefer `published`, `unlisted`, or `unpublished`. |
| `--url <url>` | `url` | Canonical item URL. |
| `--input <file|->` | Entire JSON body | Read a JSON object from a UTF-8 file, or from standard input when the value is `-`. |

JSON input may use the complete item schema documented by the target
instance, including fields not represented by the common flags.

With `--input -`, the CLI completes as soon as it receives one balanced root
JSON object. Strings, escapes, nested objects, arrays, chunk boundaries, and
trailing whitespace are handled without waiting for an interactive input
stream to close. Non-object roots, invalid JSON, and non-whitespace trailing
data are rejected. File input behavior is unchanged.

An **item image** is cover art or a thumbnail and uses the top-level `image`
field. A **media attachment** is the item's one main audio, video, document, or
image file. It uses `attachments[0]` in JSON Feed and becomes `<enclosure>` in
RSS. These fields are independent: attaching a full-resolution image does not
set the cover image, and setting a cover image does not create an enclosure.

**Standalone media** is an uploaded file that the CLI does not assign to an
item field. Use `media upload` for an image that will be embedded inside
`content_html`, then save its permanent `media_url` in the HTML. This is the
command-line counterpart to **Insert image** in the admin visual editor.

`--attachment-file` supports MP3, M4B, FLAC, MP4, PDF, DOC, DOCX, XLSX, PPT,
PPTX, TXT, AVIF, GIF, HEIC, JPEG, JPG, PNG, WebP, and CR2. The CLI infers the
attachment category and MIME type from the extension and records its byte
size. Supplying it on update replaces the existing main attachment.

For either local-file option, the CLI asks the selected instance for a
short-lived, same-site upload URL, sends only the file bytes to that URL without
a Bearer credential, and saves the returned permanent media URL on the item.
It refuses upload redirects and upload URLs hosted at another site. Standard
output contains only the final item API response; the short-lived upload URL is
never printed.

To reference already-hosted media with JSON input, use one attachment:

```json
{
  "attachments": [{
    "category": "audio",
    "url": "https://cdn.example.com/episode.mp3",
    "mime_type": "audio/mpeg",
    "size_in_bytes": 277000,
    "duration_in_seconds": 1262
  }]
}
```

Use `category: "external_url"` for a linked web page rather than a file.

## `npx @microfeed/cli item create`

**Purpose:** Create an item with `POST /api/v1/items/`.

**Changes:** Creates remote content.

```console
npx @microfeed/cli item create [item flags | --input <file|->] \
  [--validate-only | [--idempotency-key <key>] [--verify]]
```

| Option | Meaning |
| --- | --- |
| `--validate-only` | Authenticate to the target and validate against its current create schema without creating an item, uploading files, or invalidating caches. Cannot be combined with `--verify`, `--idempotency-key`, `--attachment-file`, or `--image-file`. |
| `--idempotency-key <key>` | Make retries of one logical create safe for 24 hours. Use 1–128 printable ASCII characters with no surrounding whitespace, and reuse the same key only with the same payload. |
| `--verify` | After creation and any attachment update, read the item back and return that unwrapped response. A failed read-back exits unsuccessfully and reports the already-created ID. |

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item create \
  --instance <instance-name> \
  --title "Release notes" \
  --content-html "<p>What changed.</p>" \
  --status published \
  --json

npx @microfeed/cli item create \
  --instance <instance-name> \
  --input item.json \
  --validate-only \
  --json

npx @microfeed/cli item create \
  --instance <instance-name> \
  --input item.json \
  --idempotency-key 8ca861ab-0383-4f10-bbc2-8c80d8ef29dc \
  --verify \
  --json

npx @microfeed/cli item create \
  --instance <instance-name> \
  --title "Episode 1" \
  --attachment-file ./episode.mp3 \
  --status published \
  --json

npx @microfeed/cli item create \
  --instance <instance-name> \
  --title "Full-resolution photo" \
  --attachment-file ./original.png \
  --status unlisted \
  --json

npx @microfeed/cli item create \
  --instance <instance-name> \
  --title "Photo update" \
  --image-file ./cover.png \
  --status unlisted \
  --json
```

For `item create --attachment-file`, the item must exist before the instance
can prepare its attachment upload. The CLI creates the item, uploads the file,
then updates the new item with `attachments[0]`. If upload or update fails after
creation, the error reports the new item ID so it can be inspected or repaired.

`--validate-only` sends the assembled JSON to authenticated
`POST /api/v1/items/validate/`; validation therefore reflects the target
site's deployed schema and requires that site to be reachable. It never starts
a local media workflow.

For `--idempotency-key`, the server hashes both the key and a canonical form of
the validated payload and retains the reservation for 24 hours. The first
request returns the usual `{id}` create response. A replay of the same key and
payload returns the same ID with `Idempotency-Replayed: true`; a different
payload with that key returns `409`. Reuse one generated UUID for every retry
of the same logical create. Do not generate a different key per network retry.

`--verify` runs after any create-upload-update attachment workflow. It returns
the normal `{body, headers, ok, status}` envelope with the item itself in
`body`. If read-back fails, the CLI reports the created ID and exits nonzero so
an agent can inspect or retry verification without creating a duplicate.

## `npx @microfeed/cli item update`

**Purpose:** Replace or update an item with `PUT /api/v1/items/{item-id}/`.

**Changes:** Changes remote content.

```console
npx @microfeed/cli item update <item-id> [item flags | --input <file|->]
```

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item update 0HGJLSML3P1 \
  --instance <instance-name> \
  --input - \
  --json < item.json

npx @microfeed/cli item update 0HGJLSML3P1 \
  --instance <instance-name> \
  --attachment-file ./episode.mp3 \
  --json

npx @microfeed/cli item update 0HGJLSML3P1 \
  --instance <instance-name> \
  --image-file ./cover.png \
  --json
```

## `npx @microfeed/cli item delete`

**Purpose:** Permanently delete one item.

**Changes:** Deletes remote content after exact-ID confirmation.

```console
npx @microfeed/cli item delete <item-id> [--confirm <item-id>]
```

| Option | Meaning |
| --- | --- |
| `--confirm <item-id>` | Confirm a non-interactive deletion. The value must exactly match the positional item ID. |

In an interactive terminal, omitting `--confirm` prompts you to type the exact
item ID. In non-interactive use, `--confirm` is required and its value must
exactly equal the positional ID. There is no generic `--yes` option.

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item delete 0HGJLSML3P1 \
  --instance <instance-name> \
  --confirm 0HGJLSML3P1 \
  --json
```

Before an agent runs this command, it must report the selected saved-instance
name and exact item ID, explain that deletion is permanent, and receive
approval.

## `npx @microfeed/cli media`

Upload standalone media for rich content or later use by another documented
API field.

```console
npx @microfeed/cli media upload <file> [--item-id <item-id>]
```

The upload creates a remote media object and returns its permanent URL. It does
not edit an item. Use `item --help` when you instead want to set item cover art
or the main RSS enclosure.

## `npx @microfeed/cli media upload`

**Purpose:** Upload one supported local file and return permanent, safe media
metadata.

**Changes:** Creates a stored media object. It does not insert the object into
an item, and an object that is never referenced remains stored because the CLI
has no media-delete command.

```console
npx @microfeed/cli media upload <file> \
  [--item-id <item-id>] \
  [--instance <name>] \
  [--json]
```

| Option | Meaning |
| --- | --- |
| `--item-id <item-id>` | Associate the prepared upload with an existing item. Required for audio, video, and document files; optional for images. |
| `--instance <name>` | Use this saved instance instead of the current one. |
| `--json` | Return `category`, `media_url`, `mime_type`, and `size_in_bytes`. |

Supported extensions are MP3, M4B, FLAC, MP4, PDF, DOC, DOCX, XLSX, PPT,
PPTX, TXT, AVIF, GIF, HEIC, JPEG, JPG, PNG, WebP, and CR2. The CLI infers the
category and MIME type from the extension. Images can be uploaded without an
item ID, matching the admin visual editor's inline-image flow. The current REST
contract requires an existing item ID for audio, video, and document uploads.

For an inline rich-text image, upload first:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli media upload ./diagram.png --instance <instance-name> --json
```

```json
{
  "category": "image",
  "media_url": "https://feed.example.com/media/production/images/diagram.png",
  "mime_type": "image/png",
  "size_in_bytes": 80633
}
```

Then use `media_url` in the item's HTML and create or update the item through
JSON input:

```json
{
  "content_html": "<p>Before the image.</p><img src=\"https://feed.example.com/media/production/images/diagram.png\" alt=\"Diagram\"><p>After the image.</p>"
}
```

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item update 0HGJLSML3P1 \
  --instance <instance-name> \
  --input item.json \
  --json
```

Without `--json`, successful output is only the permanent URL plus a newline,
which makes the result easy to compose in a shell. The CLI never outputs the
short-lived presigned URL. Reference the returned permanent URL promptly so an
unused upload is not left behind.

For non-image media, supply the target item:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli media upload ./episode.mp3 \
  --item-id 0HGJLSML3P1 \
  --instance <instance-name> \
  --json
```

## `npx @microfeed/cli webhook`

Create a local receiver project, inspect an exact OpenAPI example, or receive
signed webhook deliveries during local development. The CLI does not create a
microfeed endpoint or provide a public relay.

```console
npx @microfeed/cli webhook <scaffold|listen|sample> [arguments] [options]
```

Use `scaffold` to create code you can extend, `listen` to inspect or forward
signed deliveries without a project, `sample` to discover an unsigned exact
payload, and Admin Event Explorer to send a signed, budgeted, retryable test.

## `npx @microfeed/cli webhook scaffold`

**Purpose:** Copy one complete, offline webhook receiver starter into a new
local directory.

**Changes:** Creates only the destination and selected starter files. It
installs and starts nothing, creates no endpoint, reads no saved instance, and
performs no authentication. The destination must not already exist; there is
no overwrite or force option.

```console
npx @microfeed/cli webhook scaffold <directory> \
  [--language javascript|python] \
  [--json]
```

| Option | Meaning |
| --- | --- |
| `--language <language>` | Select `javascript` (the default) or `python`. |
| `--json` | Return the absolute directory, language, exact created-file list, local endpoint URL, and next-step commands. |

The JavaScript starter pins Express 5.2.1 and `standardwebhooks` 1.0.0. The
Python starter pins Flask 3.1.3 and `standardwebhooks` 1.0.1. Both bind only
`127.0.0.1:3000`, accept `POST /webhook`, verify the exact raw body with the
maintained library, return `401` or `204`, mark in-memory duplicate delivery
IDs, print the verified payload, and skip every production effect when signed
`test` is true. They never print the secret or signature.

These are local development inspectors. Their duplicate state resets on
restart, and they contain no durable queue or production side effect. Reveal
the endpoint's signing secret from its Admin **Signing secret** dialog and
store it in `MICROFEED_WEBHOOK_SECRET` through the generated `.env.example`;
the signing secret is the endpoint authentication, so a second passcode is
unnecessary.

Inside a Git-cloned microfeed source repository, use
`.microfeed/webhooks/<endpoint-name>/` as the destination. That source
repository ignores `.microfeed/`, just as it does for local theme and instance
work, so the development receiver and populated secret files are not checked
in. Move a production-hardened receiver into its own repository before
deploying it. Run the following commands from the source repository root;
`yarn microfeed` is available there as a shortcut to its local CLI version.

```console
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language javascript
yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1 \
  --language python --json
```

Human output guides you to scaffold first, register
`http://127.0.0.1:3000/webhook` and reveal its signing secret second, then
install and run with `MICROFEED_WEBHOOK_SECRET` before sending an Event
Explorer test. The same templates supply Admin quickstart code and
the OpenAPI webhook operation's JavaScript and Python `x-codeSamples`.

## `npx @microfeed/cli webhook listen`

**Purpose:** Start a development receiver, verify Standard Webhooks signatures
against exact request bytes, print each event, and optionally make the
loopback listener temporarily reachable from a deployed microfeed instance.

**Changes:** Listens on `127.0.0.1:8978/webhook` until interrupted. It does not
change local content or any remote microfeed resource. `--tunnel` starts a
temporary Cloudflare Quick Tunnel subprocess and may, with explicit approval,
download one verified `cloudflared` executable into a versioned microfeed cache.

```console
npx @microfeed/cli webhook listen \
  [--secret-file <path>] \
  [--forward-to <url>] \
  [--port <1-65535>] \
  [--tunnel] \
  [--install-cloudflared|--cloudflared-path <path>] \
  [--json]
```

| Option | Meaning |
| --- | --- |
| `--secret-file <path>` | Read the signing secret from a UTF-8 file. Without it or `MICROFEED_WEBHOOK_SECRET`, the listener uses a visible terminal prompt so pasted text can be checked before submission. |
| `--forward-to <url>` | Forward verified requests to an HTTP loopback URL with an explicit port. Exact body bytes and webhook headers are preserved. |
| `--port <1-65535>` | Change the loopback listener port from its 8978 default. |
| `--tunnel` | Start a free, temporary Cloudflare Quick Tunnel and print its random public HTTPS `/webhook` URL. |
| `--install-cloudflared` | With `--tunnel`, explicitly approve downloading the pinned official helper without an interactive confirmation. |
| `--cloudflared-path <path>` | With `--tunnel`, use a managed `cloudflared` executable instead of PATH or the microfeed cache. |
| `--json` | Write one NDJSON object for each verified delivery. |

There is deliberately no plaintext `--secret` option. Add
`http://127.0.0.1:8978/webhook` under **Admin → Webhooks → Endpoints**, then use
the endpoint's revealed signing secret with the listener. Deployed endpoints
require HTTPS; this HTTP exception exists only for local development.

To receive a signed test from a deployed instance without deploying a receiver,
run:

```console
npx @microfeed/cli webhook listen --tunnel
```

Plain `webhook listen` remains loopback-only. Tunnel mode first looks for
`cloudflared` on PATH and then in the versioned microfeed cache. When neither
exists in an interactive terminal, it shows the pinned version, approximate
download size, cache destination, and asks before downloading. The CLI obtains
the executable from Cloudflare's official GitHub release, verifies the exact
asset SHA-256 digest, installs nothing system-wide, requests no administrator
access, and does not modify PATH. For a non-interactive terminal, explicitly
add `--install-cloudflared` or provide `--cloudflared-path`.

After Cloudflare returns the temporary hostname, the CLI prints the exact
public `/webhook` URL before asking for the endpoint's signing secret. Create
that URL under **Admin → Webhooks → Endpoints**, reveal the endpoint's `whsec_…`
secret, and paste it into the visible prompt. Then send `webhook.test` from Event
Explorer. Status and tunnel diagnostics stay on stderr, so `--json` stdout
remains one NDJSON object per verified delivery.

The random Quick Tunnel URL is public and works only while this command is
running. Standard Webhooks verification remains the authentication boundary;
invalid requests are rejected before printing or forwarding. Quick Tunnels are
free development infrastructure with no uptime guarantee, not a production
receiver or hosted microfeed relay. Pressing Ctrl+C stops both the listener and
its child tunnel. A new run receives a new URL, so delete or update the
temporary endpoint afterward. See Cloudflare's [Quick Tunnel
documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
and [official downloads](https://developers.cloudflare.com/tunnel/downloads/).

Without a forward target, a verified delivery returns `204`. Forwarding has a
nine-second timeout and returns `502` for connection failure or `504` for a
timeout. A duplicate delivery ID is marked in human or NDJSON output but is
still forwarded so the target's own deduplication can be tested.

```console
npx @microfeed/cli webhook listen

npx @microfeed/cli webhook listen --tunnel

MICROFEED_WEBHOOK_SECRET=whsec_... \
  npx @microfeed/cli webhook listen --json

npx @microfeed/cli webhook listen \
  --secret-file .webhook-secret \
  --forward-to http://127.0.0.1:3000/hooks/microfeed
```

See [Test webhooks without code](/webhooks/testing/) for the local and deployed
signed-testing workflows. See [Webhooks and integrations](/webhooks/) for
enablement, endpoint creation, and safe shutdown.

## `npx @microfeed/cli webhook sample`

**Purpose:** Print the exact named example published by one instance's
generated OpenAPI webhook operation.

**Changes:** None. The command makes one unauthenticated read of public API
documentation and writes the example to standard output.

```console
npx @microfeed/cli webhook sample <event> [--instance <name>] [--json]
```

Use an exact event type such as `item.published`,
`page.navigation_updated`, or `webhook.test`. The CLI resolves the site using
normal saved-instance selection or `MICROFEED_URL`, reads
`/api/v1/openapi.json`, and selects that event's named example. It does not
bundle a second schema.

Without `--json`, output includes a short heading and formatted payload. With
`--json`, standard output contains only the one example envelope, which is
suitable for agents, fixtures, and pipes. Generated examples have signed-body
shape `test: true`; a receiver must verify a delivered signature before
trusting that field and must prevent test events from producing production
side effects.

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli webhook sample item.published
npx @microfeed/cli webhook sample page.navigation_updated --instance <instance-name> --json
MICROFEED_URL=http://127.0.0.1:4321 \
  npx @microfeed/cli webhook sample webhook.test --json
```

If the contract is unavailable, enable **Publish API docs** in **Admin → API →
API Settings**, or inspect the same canonical examples in **Admin → Webhooks →
Event explorer**.

## `npx @microfeed/cli api`

**Purpose:** Call a documented REST operation while the CLI selects, injects,
and refreshes credentials.

**Changes:** Depend on the HTTP method and API endpoint.

```console
npx @microfeed/cli api <method> </api/v1/path> \
  [--input <file|->] \
  [--header <name:value>]…
```

| Option | Meaning |
| --- | --- |
| `--input <file|->` | Read the request body from a UTF-8 file or standard input. If no content type is supplied, the CLI uses `application/json`. |
| `--header <name:value>` | Add a request header. Repeat the option for multiple headers. |

The path must be relative, begin with `/api/v1/`, and remain on the selected
site URL. The CLI rejects caller-provided `Authorization`, `Cookie`, and `Host`
headers. It returns an error rather than following a redirect.

`--input` reads UTF-8 request bodies and does not upload binary files or follow
prepared upload URLs. Use `media upload <file>` for inline or standalone media,
`--attachment-file <path>` for a local media attachment/RSS enclosure, and
`--image-file <path>` for local item cover art.

Quote paths containing `?` or `&` so the shell passes them as one argument.

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli api GET "/api/v1/feed/?limit=3" \
  --instance <instance-name> \
  --json

npx @microfeed/cli api POST /api/v1/items/ \
  --instance <instance-name> \
  --input item.json \
  --header "Content-Type: application/json" \
  --json
```

## Output and errors

Without `--json`, API response bodies go to standard output. JSON response
bodies are pretty-printed, while text bodies are preserved. Diagnostics and a
non-success HTTP status message go to standard error.

With `--json`, API commands return one JSON object:

```json
{
  "body": {},
  "headers": {
    "content-type": "application/json"
  },
  "ok": true,
  "status": 200
}
```

A `404` result adds a structured `recovery` object with a stable `code`, a
documentation URL, and safe instructions for the owner or agent. It does not
contain a credential or assume the dashboard uses the default `/admin/` path.

```json
{
  "body": "404",
  "headers": {
    "content-type": "text/plain; charset=utf-8"
  },
  "ok": false,
  "status": 404,
  "recovery": {
    "code": "api_access_or_resource_not_found",
    "documentationUrl": "https://docs.microfeed.org/api/authentication/#enable-the-api",
    "instructions": [
      "New microfeed instances keep API access disabled by default.",
      "The site owner should sign in to the admin dashboard, open API → API Settings, and turn on Enable API access.",
      "If you are an AI agent, pause and ask the site owner to complete that browser step; do not request their dashboard password, API key, or CLI credential.",
      "After API access is enabled, retry the same command. If it is already enabled, verify that the requested resource and /api/v1/ path exist."
    ],
    "message": "API access may be disabled, or the requested resource may not exist."
  }
}
```

Only safe response headers are included: `cache-control`, `content-length`,
`content-type`, `etag`, `last-modified`, and `x-request-id`. Saved-instance
commands also return one deterministic JSON object when `--json` is present.
`media upload --json` returns `category`, permanent `media_url`, `mime_type`,
and `size_in_bytes`; it never returns the prepared upload URL.

CLI validation failures, authentication failures, transport failures, and
non-success API responses set a nonzero exit status. Missing authentication is
never an interactive token prompt; the error tells you to run `login` or select
a saved instance. Content commands require API access to be enabled. Because a
disabled API intentionally returns `404`, that status can mean either that the
requested resource does not exist or that API access is disabled. The CLI
explains that new instances default to disabled, directs the owner to **API →
API Settings → Enable API access**, tells an AI agent to pause for that browser
step, and links to the [API setup guide](/api/authentication/#enable-the-api).

## Saved instances and credentials

Saved instances record the verified instance ID, site URL, authorization endpoints,
and an AES-256-GCM encrypted token bundle. The encryption key exists only in the
operating-system keychain under the `microfeed-cli` service. The CLI never
falls back to plaintext storage.

The instance store is `instances.json` in the platform configuration directory:

- `$XDG_CONFIG_HOME/microfeed`, or `~/.config/microfeed` when
  `XDG_CONFIG_HOME` is unset;
- `%APPDATA%\microfeed` on Windows.

The directory and file are created with owner-only permissions where the
platform supports them. Do not read, print, copy, or commit the encrypted
store. If the keychain is unavailable or locked, the CLI fails without storing
credentials. Install the optional `@napi-rs/keyring` dependency when the
published package manager did not install it for the current platform.

CLI credentials are refreshed automatically when they are within one
minute of expiry. A successful refresh rotates the locally encrypted bundle.
When refresh fails or no refresh token exists, log in again.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MICROFEED_API_KEY` | Use an existing API key as the Bearer credential. It takes precedence over saved browser credentials and is never persisted. Supply it through a CI secret manager. |
| `MICROFEED_URL` | Set the target site URL for API-key operations or `webhook sample`. HTTPS is required except for local loopback site URLs. |
| `MICROFEED_INSTANCE` | Select a saved instance when `--instance` is omitted. |
| `MICROFEED_WEBHOOK_SECRET` | Supply the signing secret to `webhook listen` without a prompt. Prefer a development secret manager; never commit it. |
| `MICROFEED_CACHE_DIR` | Override the base cache directory. The deployment launcher keeps its replaceable source and dependencies in a `manage/` child directory. |
| `MICROFEED_CONFIG_DIR` | Override the base configuration directory. Content instances live directly in this directory; deployment state lives in its separate `manage/` child directory. Intended for isolated environments and tests; it does not weaken encryption or replace the OS keychain. |

Never place a credential directly in a command, checked-in file, log,
generated example, or agent conversation.

## Built-in help

```console
npx @microfeed/cli manage --help
npx @microfeed/cli --help
npx @microfeed/cli help
npx @microfeed/cli login --help
npx @microfeed/cli instances use -h
npx @microfeed/cli item create --help
npx @microfeed/cli help item delete
npx @microfeed/cli webhook scaffold --help
npx @microfeed/cli webhook sample --help
npx @microfeed/cli media upload --help
npx @microfeed/cli webhook listen --help
npx @microfeed/cli api --help
```

Top-level help defines inputs such as `<site-url>`, `<name>`, `<item-id>`, and
`<file|->` with legitimate examples. Every command and nested subcommand
supports both `-h` and `--help`, including after other arguments, and the
equivalent `help [command [subcommand]]` form. Command help lists its purpose,
exact usage, every option, input formats, changes or safety constraints,
examples, and a link to the matching section of this page. Help never starts
browser login or sends an API request.

## Maintaining this reference

The shared human-and-agent help inventory lives in `packages/cli/src/help.ts`.
Command dispatch lives in `packages/cli/src/index.ts`, and command behavior
lives in `packages/cli/src/commands.ts`, with authentication, HTTP, and
saved-instance storage guarantees in the neighboring CLI modules. Tests require
every help topic and option to appear in this canonical reference and verify
the workspace and packed package render the same help. When behavior changes,
update the implementation, help inventory, tests, and this page together.
