---
title: Manage content with the microfeed CLI
description: Run the local or published @microfeed/cli, authorize an instance in the browser, and manage content safely from a terminal or coding agent.
---

The `@microfeed/cli` package gives people and coding agents a consistent way to
manage one or more microfeed instances without handling OAuth tokens directly.

## Choose an invocation

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

A global installation is optional and is not required for these workflows.

## Log in to an instance

```console
yarn microfeed login https://feed.example.com --profile production
```

The CLI reads the unchanged `/.well-known/microfeed.json` identity document,
then loads standard OAuth authorization-server metadata from the same HTTPS
origin. It rejects a cross-origin issuer or token endpoint. If the public origin
changes, log in again.

The command opens a browser for administrator login and permission approval.
The terminal or coding agent cannot approve the browser prompt for you. The
callback uses `127.0.0.1:8977`; if that port is unavailable, close the process
using it and retry.

Manage saved profiles with:

```console
yarn microfeed instances list
yarn microfeed instances use production
yarn microfeed logout --instance production
```

Logout revokes the remote refresh-token family before removing the local
profile.

## Manage items

Use `--json` when another program or coding agent will consume the result:

```console
yarn microfeed item list --instance production --json
yarn microfeed item get <item-id> --instance production --json
yarn microfeed item create --instance production --input item.json --json
yarn microfeed item update <item-id> --instance production --input - --json
```

Create and update accept either a JSON file or standard input with `--input`,
or common flags such as `--title`, `--content-html`, and `--status`. Do not mix
JSON input and item flags in one command.

Deletion requires an interactive exact-ID confirmation. In deterministic
automation, provide the same ID explicitly only after reviewing the target:

```console
yarn microfeed item delete <item-id> --instance production --confirm <item-id> --json
```

## Call a documented REST operation

The raw command accepts only relative `/api/v1/…` paths:

```console
yarn microfeed api GET /api/v1/feed/?limit=3 --instance production --json
yarn microfeed api POST /api/v1/items/ --instance production --input item.json --json
```

It injects and refreshes credentials internally, refuses caller-provided
`Authorization`, `Cookie`, and `Host` headers, and never forwards credentials
through a redirect. Without `--json`, response bodies go to standard output and
diagnostics go to standard error. With `--json`, output contains the status,
safe response headers, and body—but never a credential.

## Use an API key in CI

Set `MICROFEED_API_KEY` in the CI secret manager and identify the target with a
saved profile or `MICROFEED_ORIGIN`. The environment credential takes
precedence and is never persisted:

```console
MICROFEED_ORIGIN=https://feed.example.com yarn microfeed item list --json
```

Do not put the key directly in the command, configuration file, logs, or agent
conversation.
