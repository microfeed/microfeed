---
title: yarn microfeed command reference
description: Canonical commands, options, authentication behavior, output, and safety rules for @microfeed/cli.
---

This is the canonical capability reference for `@microfeed/cli`, including the
`yarn microfeed` command available inside a microfeed clone. For a shorter
workflow, start with [Manage content with the microfeed CLI](/api/cli/).

## Contents

- [Run the CLI](#run-the-cli)
- [Agent skill](#agent-skill)
- [Authentication and safety](#authentication-and-safety)
- [Command summary](#command-summary)
- [Global options](#global-options)
- [`login`](#yarn-microfeed-login)
- [`logout`](#yarn-microfeed-logout)
- [`instances`](#yarn-microfeed-instances)
- [`item`](#yarn-microfeed-item)
- [`item list`](#yarn-microfeed-item-list)
- [`item get`](#yarn-microfeed-item-get)
- [`item create`](#yarn-microfeed-item-create)
- [`item update`](#yarn-microfeed-item-update)
- [`item delete`](#yarn-microfeed-item-delete)
- [`api`](#yarn-microfeed-api)
- [Output and errors](#output-and-errors)
- [Saved instances and credentials](#saved-instances-and-credentials)
- [Environment variables](#environment-variables)
- [Built-in help](#built-in-help)

## Run the CLI

`@microfeed/cli` requires Node.js 22.12 or newer. Choose the invocation that
matches where you are working.

| Context | Command | Installation behavior |
| --- | --- | --- |
| Inside a microfeed clone | `yarn microfeed …` | Uses the local workspace after the repository's normal `yarn install`. It does not require a CLI build, registry download, or global installation. |
| Another Yarn project | `yarn add -D @microfeed/cli`, then `yarn microfeed …` | Uses the project-local package and binary. |
| One-off use | `yarn dlx @microfeed/cli …` | Downloads a temporary package for this run. |
| Optional global installation | `microfeed …` | Uses the same published executable, but global installation is not the recommended path. |

The examples below use `yarn microfeed`. Replace that prefix with
`yarn dlx @microfeed/cli` or `microfeed` when using one of the other modes.

## Agent skill

Inside a microfeed clone, agent hosts discover the repository-owned
`manage-microfeed-content` skill at
`.agents/skills/manage-microfeed-content/`. The published npm tarball contains
the identical skill at `dist/skills/manage-microfeed-content/` for agent hosts
or skill installers that distribute skills with the CLI. The repository copy
is canonical, and the package check fails when the bundled copy differs.

The skill teaches invocation selection, site and instance vocabulary,
browser-consent handoff, deterministic output, the difference between item
images and media attachments, credential safety, and deletion confirmation.

## Authentication and safety

The CLI uses OAuth for interactive work and an existing API key for unattended
work. Both are sent to the REST API as Bearer credentials. OAuth does not make
the API credential-free.

Browser login:

1. Verifies `/.well-known/microfeed.json` identifies the target as microfeed.
2. Loads standard OAuth authorization-server metadata from the same site URL.
3. Rejects redirects and OAuth issuers or endpoints hosted at another site.
4. Opens administrator login and consent in the browser.
5. Uses authorization-code flow, S256 PKCE, and state validation.
6. Listens for the callback only at `http://127.0.0.1:8977/callback`.
7. Requests `content:read`, `content:write`, and `offline_access`.

The person operating the instance must approve or deny access in the browser.
A coding agent may start login, but must pause for that user-controlled step.
Login requires HTTPS except for `http://localhost` and `http://127.0.0.1` test
instances. If a site's public URL changes, log in again.

For every authenticated REST request, the CLI:

- injects the selected Bearer credential and refreshes OAuth tokens when
  needed;
- accepts only the selected site URL;
- does not follow redirects or forward credentials through one;
- never prints access tokens, refresh tokens, API keys, or client secrets.

## Command summary

| Command | Purpose | Local or remote change |
| --- | --- | --- |
| `login <site-url>` | Authorize the official public CLI client in a browser and save an instance. | Creates or replaces a local encrypted saved instance after browser consent. |
| `logout` | Revoke the selected OAuth token family and remove its saved instance locally. | Changes both the site and local instance store. |
| `instances list` | List saved instances and the current selection. | Read-only. |
| `instances use <name>` | Select the default saved instance. | Changes only the local current-instance pointer. |
| `instances remove <name>` | Remove a saved instance locally without contacting the site. | Changes only the local instance store. |
| `item list` | Read a page of the feed. | Read-only. |
| `item get <item-id>` | Read one item. | Read-only. |
| `item create` | Create an item from flags or JSON. | Creates remote content. |
| `item update <item-id>` | Update an item from flags or JSON. | Changes remote content. |
| `item delete <item-id>` | Delete an item after exact-ID confirmation. | Permanently deletes remote content. |
| `api <method> <path>` | Call a relative `/api/v1/…` REST endpoint. | Depends on the method and endpoint. |

## Global options

Global options may appear before or after a command and its arguments.

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Use a saved instance instead of the current one. This takes precedence over `MICROFEED_INSTANCE`. |
| `--json` | Write deterministic JSON to standard output. API responses include `status`, `ok`, safe response `headers`, and `body`. |
| `-h`, `--help` | Show help for the selected command or subcommand without running it. |

When `MICROFEED_API_KEY` is set, `--instance` selects its site URL from a saved
instance; it does not cause the saved OAuth credential to be used.

## `yarn microfeed login`

**Purpose:** Verify and authorize a microfeed site, then save it as the current
instance.

**Changes:** After browser approval, creates or replaces a local encrypted
saved instance and makes it current. It does not expose a credential in terminal
output.

```console
yarn microfeed login <site-url> [--instance <name>]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Save the site under this local instance name. Names contain 1–64 letters, numbers, dots, underscores, or hyphens. |

Without `--instance`, the CLI derives the name from the site hostname.
Use the URL that opens the public microfeed site. It may use a custom domain or
the generated `workers.dev` address; do not use a dashboard path such as
`https://feed.example.com/admin`.
Login requests the official `microfeed-cli` public client with the fixed
loopback callback. The callback port must be available, and browser approval
must complete within five minutes.

```console
yarn microfeed login https://feed.example.com --instance production
```

With `--json`, success returns the saved `name`, canonical `siteUrl`, and
verified `instanceId`.

## `yarn microfeed logout`

**Purpose:** Revoke the selected OAuth authorization and remove its saved
instance locally.

**Changes:** Attempts to revoke the refresh token, or the access token when no
refresh token exists, then deletes the saved instance locally. If it was
current, the alphabetically first remaining instance becomes current.

```console
yarn microfeed logout [--instance <name>]
```

If revocation cannot be delivered, logout still removes the saved instance. An
instance owner can revoke the application separately from **API → Authorized
applications**.

Use `instances remove` instead when local credentials are unreadable or when
you intentionally want a local-only removal.

## `yarn microfeed instances`

Manage locally saved instances.

## `yarn microfeed instances list`

**Purpose:** List instance names, site URLs, instance IDs in JSON output, and
the current selection.

**Changes:** None.

```console
yarn microfeed instances list [--json]
```

Human-readable output marks the current instance with `*`. JSON output returns
an `instances` array whose entries contain `name`, `siteUrl`, `instanceId`,
and `current`.

## `yarn microfeed instances use`

**Purpose:** Select the default saved instance for later commands.

**Changes:** Updates only the local current-instance pointer.

```console
yarn microfeed instances use <name> [--json]
```

## `yarn microfeed instances remove`

**Purpose:** Remove a saved instance locally without decrypting or revoking its
OAuth tokens.

**Changes:** Deletes the saved instance locally. It does not contact the site.

```console
yarn microfeed instances remove <name> [--json]
```

Use `logout` for the normal revoke-and-remove workflow. Use `remove` for local
cleanup or recovery when the keychain entry is unavailable.

## `yarn microfeed item`

List, read, create, update, or delete content items. An `<item-id>` is the
stable ID returned by `item list` or `item get`, such as `0HGJLSML3P1`.
Create and update accept either common flags or one JSON object from `--input`;
they reject mixed input forms. Delete is permanent and requires an exact
item-ID confirmation.

```console
yarn microfeed item <list|get|create|update|delete> [arguments] [options]
```

## `yarn microfeed item list`

**Purpose:** Read a page from `GET /api/v1/feed/`.

**Changes:** None.

```console
yarn microfeed item list [options]
```

| Option | Meaning |
| --- | --- |
| `--limit <1-300>` | Maximum number of items to return. |
| `--next-cursor <cursor>` | Continue forward from a response cursor. |
| `--prev-cursor <cursor>` | Continue backward from a response cursor. |
| `--sort <field>` | Use `created_at`, `updated_at`, `published_at`, `newest_first`, or `oldest_first`. |
| `--order <direction>` | Use `asc` or `desc`. |

```console
yarn microfeed item list --instance production --limit 25 --json
```

## `yarn microfeed item get`

**Purpose:** Read one item by ID or an item-page slug ending in its ID.

**Changes:** None.

```console
yarn microfeed item get <item-id>
```

```console
yarn microfeed item get 0HGJLSML3P1 --instance production --json
```

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

An **item image** is cover art or a thumbnail and uses the top-level `image`
field. A **media attachment** is the item's one main audio, video, document, or
image file. It uses `attachments[0]` in JSON Feed and becomes `<enclosure>` in
RSS. These fields are independent: attaching a full-resolution image does not
set the cover image, and setting a cover image does not create an enclosure.

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

## `yarn microfeed item create`

**Purpose:** Create an item with `POST /api/v1/items/`.

**Changes:** Creates remote content.

```console
yarn microfeed item create [item flags | --input <file|->]
```

```console
yarn microfeed item create \
  --instance production \
  --title "Release notes" \
  --content-html "<p>What changed.</p>" \
  --status published \
  --json

yarn microfeed item create \
  --instance production \
  --input item.json \
  --json

yarn microfeed item create \
  --instance production \
  --title "Episode 1" \
  --attachment-file ./episode.mp3 \
  --status published \
  --json

yarn microfeed item create \
  --instance production \
  --title "Full-resolution photo" \
  --attachment-file ./original.png \
  --status unlisted \
  --json

yarn microfeed item create \
  --instance production \
  --title "Photo update" \
  --image-file ./cover.png \
  --status unlisted \
  --json
```

For `item create --attachment-file`, the item must exist before the instance
can prepare its attachment upload. The CLI creates the item, uploads the file,
then updates the new item with `attachments[0]`. If upload or update fails after
creation, the error reports the new item ID so it can be inspected or repaired.

## `yarn microfeed item update`

**Purpose:** Replace or update an item with `PUT /api/v1/items/{item-id}/`.

**Changes:** Changes remote content.

```console
yarn microfeed item update <item-id> [item flags | --input <file|->]
```

```console
yarn microfeed item update 0HGJLSML3P1 \
  --instance production \
  --input - \
  --json < item.json

yarn microfeed item update 0HGJLSML3P1 \
  --instance production \
  --attachment-file ./episode.mp3 \
  --json

yarn microfeed item update 0HGJLSML3P1 \
  --instance production \
  --image-file ./cover.png \
  --json
```

## `yarn microfeed item delete`

**Purpose:** Permanently delete one item.

**Changes:** Deletes remote content after exact-ID confirmation.

```console
yarn microfeed item delete <item-id> [--confirm <item-id>]
```

| Option | Meaning |
| --- | --- |
| `--confirm <item-id>` | Confirm a non-interactive deletion. The value must exactly match the positional item ID. |

In an interactive terminal, omitting `--confirm` prompts you to type the exact
item ID. In non-interactive use, `--confirm` is required and its value must
exactly equal the positional ID. There is no generic `--yes` option.

```console
yarn microfeed item delete 0HGJLSML3P1 \
  --instance production \
  --confirm 0HGJLSML3P1 \
  --json
```

Before an agent runs this command, it must report the selected saved-instance
name and exact item ID, explain that deletion is permanent, and receive
approval.

## `yarn microfeed api`

**Purpose:** Call a documented REST operation while the CLI selects, injects,
and refreshes credentials.

**Changes:** Depend on the HTTP method and API endpoint.

```console
yarn microfeed api <method> </api/v1/path> \
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
prepared upload URLs. Use `item create --attachment-file <path>` or `item
update <item-id> --attachment-file <path>` for a local media attachment/RSS
enclosure. Use `--image-file <path>` for local item cover art.

Quote paths containing `?` or `&` so the shell passes them as one argument.

```console
yarn microfeed api GET "/api/v1/feed/?limit=3" \
  --instance production \
  --json

yarn microfeed api POST /api/v1/items/ \
  --instance production \
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

Only safe response headers are included: `cache-control`, `content-length`,
`content-type`, `etag`, `last-modified`, and `x-request-id`. Saved-instance
commands also return one deterministic JSON object when `--json` is present.

CLI validation failures, authentication failures, transport failures, and
non-success API responses set a nonzero exit status. Missing authentication is
never an interactive token prompt; the error tells you to run `login` or select
a saved instance. Content commands require API access to be enabled. Because a
disabled API intentionally returns `404`, that status can mean either that the
requested resource does not exist or that API access is disabled.

## Saved instances and credentials

Saved instances record the verified instance ID, site URL, OAuth endpoints,
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

OAuth access tokens are refreshed automatically when they are within one
minute of expiry. A successful refresh rotates the locally encrypted bundle.
When refresh fails or no refresh token exists, log in again.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MICROFEED_API_KEY` | Use an existing API key as the Bearer credential. It takes precedence over saved OAuth credentials and is never persisted. Supply it through a CI secret manager. |
| `MICROFEED_URL` | Set the API-key target site URL when no selected saved instance supplies one. HTTPS is required except for local loopback site URLs. |
| `MICROFEED_INSTANCE` | Select a saved instance when `--instance` is omitted. |
| `MICROFEED_CONFIG_DIR` | Override the instance-store directory. Intended for isolated environments and tests; it does not weaken encryption or replace the OS keychain. |

Never place a credential directly in a command, checked-in file, log,
generated example, or agent conversation.

## Built-in help

```console
yarn microfeed --help
yarn microfeed help
yarn microfeed login --help
yarn microfeed instances use -h
yarn microfeed item create --help
yarn microfeed help item delete
yarn microfeed api --help
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
