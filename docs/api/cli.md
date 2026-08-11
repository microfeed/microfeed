---
title: Manage content with the microfeed CLI
description: Run the local or published @microfeed/cli, authorize an instance in the browser, and manage content safely from a terminal or coding agent.
---

The official
[`@microfeed/cli` package](https://www.npmjs.com/package/@microfeed/cli) gives
people and coding agents a consistent way to publish and manage content on one
or more microfeed sites without handling credentials directly. For every
command, option, output contract, and safety rule, use the canonical
[microfeed cli reference](/microfeed-cli/).

## Choose an invocation

Choose the form that matches where you are working:

| Where you are working | Recommended command |
| --- | --- |
| Inside a microfeed clone | `yarn microfeed …` |
| Inside another Yarn project | Install `@microfeed/cli` locally, then use `yarn microfeed …` |
| One command without installation | `yarn dlx @microfeed/cli …` |
| Regular use across unrelated directories | Install globally, then use `microfeed …` |

Inside a microfeed repository clone, use the local workspace after the normal
dependency installation:

```console
yarn microfeed --help
```

No CLI build, registry download, or global installation is required. The root
command and published package use the same command modules.

In another project, install it locally:

```console
yarn add -D @microfeed/cli
yarn microfeed --help
```

For one-off use without installation:

```console
yarn dlx @microfeed/cli --help
```

A global installation is optional and is not required for these workflows:

```console
npm install --global @microfeed/cli
microfeed --help
```

## Start with a content goal

An agent needs the task and your microfeed site URL—not a credential. For
example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if API access must be
enabled, browser authorization is required, or a destructive action needs
confirmation.
```

The agent can inspect `--help`, prepare file or standard-input payloads, and
run the content command. You complete login and permission approval in the
browser when required.

## Log in to an instance

New microfeed instances keep API access disabled by default. Before content
commands can succeed, the site owner signs in to the Admin dashboard, opens
**API → API Settings**, and turns on **Enable API access**. This is a
browser-only owner action; an agent must pause and ask the owner to complete it
without requesting a dashboard password, API key, or CLI credential. See
[Enable the API](../authentication/#enable-the-api).

```console
yarn microfeed login https://feed.example.com --instance production
```

The first argument is the **site URL**: the root URL that opens the public
microfeed site. It may use a custom domain or the generated `workers.dev`
address, but it must not include a dashboard path, query, or fragment.
`production` is a local **instance name**, not a username or Wrangler profile.

The CLI reads the unchanged `/.well-known/microfeed.json` identity document,
then loads its authorization endpoints from the same HTTPS site URL. It
rejects an endpoint hosted at another site. If the public site URL changes, log
in again.

The command opens a browser for administrator login and permission approval.
The terminal or coding agent cannot approve the browser prompt for you. The
callback uses `127.0.0.1:8977`; if that port is unavailable, close the process
using it and retry. Browser login can be saved while API access is disabled; the
first content command then returns `404` with recovery instructions.

OAuth browser authorization also requires microfeed's built-in login.
Cloudflare Access can protect the routes, but it does not create the microfeed
application session OAuth needs. If authorization is unavailable, enable
built-in login from the connected repository with `yarn manage auth setup` and
retry. Newer identity documents expose this capability directly, and the CLI
provides compatible guidance for older sites.

Manage saved instances with:

```console
yarn microfeed instances list
yarn microfeed instances use production
yarn microfeed logout --instance production
```

Logout revokes the remote refresh-token family before removing the saved
instance locally.

## Manage items

Use `--json` when another program or coding agent will consume the result:

```console
yarn microfeed item list --summary --instance production --json
yarn microfeed item search hello --fields title --instance production --json
yarn microfeed item get <item-id> --unwrap --instance production --json
yarn microfeed item create --instance production --input item.json --validate-only --json
yarn microfeed item create --instance production --input item.json --idempotency-key 8ca861ab-0383-4f10-bbc2-8c80d8ef29dc --verify --json
yarn microfeed item update <item-id> --instance production --input - --json
yarn microfeed item update <item-id> --instance production --attachment-file ./episode.mp3 --json
yarn microfeed item update <item-id> --instance production --image-file ./cover.png --json
yarn microfeed media upload ./inline-image.png --instance production --json
```

Create and update accept either a JSON file or standard input with `--input`,
or common flags such as `--title`, `--content-html`, and `--status`. Do not mix
JSON input and item flags in one command.

`item list --summary` and `item get --unwrap` preserve the JSON response
envelope while removing channel metadata. Add `--fields` for an allowlisted
item projection; summary defaults to
`id,title,status,date_published,date_modified,url` and preserves pagination.

`item create --validate-only` sends the assembled JSON to the authenticated
target's current schema without creating content, uploading local files, or
invalidating caches. For a real create, generate one UUID per logical item,
pass it as `--idempotency-key`, and reuse the same key and payload for every
retry within 24 hours. Add `--verify` to return an unwrapped read-back after
creation and any attachment update. If read-back fails, the CLI exits nonzero
and reports the item ID that was already created.

With `--input -`, the CLI continues after one complete root JSON object arrives
without waiting for an interactive input stream to close. File input is
unchanged.

Search accepts one 1–200 character query and the same filters as the item
search API. For example, search only titles for an exact phrase:

```console
yarn microfeed item search '"season finale"' \
  --fields title \
  --status published,unlisted \
  --instance production \
  --json
```

Unquoted terms use AND matching, the final unquoted term supports prefix
matching, and exact results rank before typo-tolerant title results. Use
`--next-cursor` with the same query and filters to continue forward.

Use `--attachment-file <path>` for the item's one main media attachment. It may
be audio, video, a document, or an image; it becomes JSON Feed
`attachments[0]` and the RSS `<enclosure>`. The CLI infers the category, MIME
type, and byte size from supported common extensions. On create, the CLI first
creates the item so it has an ID, then uploads and attaches the file.

Use `--image-file <path>` for item cover art or a thumbnail. Supported cover
images are AVIF, GIF, JPEG, PNG, and WebP. Use `--image <url>` only for cover
art already hosted at an absolute URL. An item image and a media attachment are
independent fields.

For both file options, the CLI sends the bytes without exposing or forwarding
its Bearer credential and never prints the short-lived upload URL.

For an image embedded in `content_html`, use the standalone uploader rather
than the cover-image or attachment flags:

```console
yarn microfeed media upload ./diagram.png --instance production --json
```

Read the permanent `media_url` from the result, insert it in an `<img src>` in
your item JSON, and then create or update the item with `--input`. This mirrors
**Insert image** in the admin visual editor. The upload command does not edit an
item; reference the returned URL promptly. Images need no item ID. Audio,
video, and documents require `--item-id <item-id>` under the current REST
contract.

Deletion requires an interactive exact-ID confirmation. In deterministic
automation, provide the same ID explicitly only after reviewing the target:

```console
yarn microfeed item delete <item-id> --instance production --confirm <item-id> --json
```

## Call a documented REST operation

The raw command accepts only relative `/api/v1/…` paths:

```console
yarn microfeed api GET "/api/v1/feed/?limit=3" --instance production --json
yarn microfeed api POST /api/v1/items/ --instance production --input item.json --json
```

It injects and refreshes credentials internally, refuses caller-provided
`Authorization`, `Cookie`, and `Host` headers, and never forwards credentials
through a redirect. Without `--json`, response bodies go to standard output and
diagnostics go to standard error. With `--json`, output contains the status,
safe response headers, and body—but never a credential.

The raw command reads UTF-8 request bodies; it is not a binary-file uploader.
Use `media upload` for inline or standalone media, `--attachment-file` for a
local media attachment/RSS enclosure, and `--image-file` for local item cover
art.

Content commands require API access to be enabled on the selected instance. A
`404` can mean the requested resource does not exist or API access is disabled.
The CLI prints the exact dashboard navigation and agent handoff to standard
error. With `--json`, stdout also contains a `recovery` object with a stable
code, documentation URL, and safe next steps.

## Use an API key in CI

Set `MICROFEED_API_KEY` in the CI secret manager and identify the target with a
saved instance or `MICROFEED_URL`. The environment credential takes
precedence and is never persisted:

```console
MICROFEED_URL=https://feed.example.com yarn microfeed item list --json
```

Do not put the key directly in the command, configuration file, logs, or agent
conversation.
