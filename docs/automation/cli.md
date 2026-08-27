---
title: Manage content with @microfeed/cli
description: Enable API access, authorize a site in the browser, and use the guided content commands from a terminal or coding agent.
---

`@microfeed/cli` wraps the authenticated API in task-oriented commands for
people and local coding agents. It manages browser authorization internally,
so an agent can work with content without reading or copying an API key.

For every command, option, JSON field, and edge case, use the exhaustive
[`@microfeed/cli` reference](/microfeed-cli/).

## Choose an invocation

| Where you are working | Command |
| --- | --- |
| Recommended from any folder | `npx @microfeed/cli …` |
| Git-cloned microfeed source repository after `yarn install` | `yarn microfeed …` |
| Global installation | `microfeed …` |

Start from any folder with:

```console
npx @microfeed/cli --help
```

## Enable API access and log in

An administrator first opens **API → API Settings** and enables API access.
Then authorize the CLI:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli login https://feed.example.com --instance <instance-name>
```

The command opens a browser. The administrator signs in, reviews the requested
permissions, and approves or denies them there. A coding agent may start the
command but must pause for this handoff; it must never ask for a dashboard
password, API key, access token, or refresh token.

Select and inspect saved sites with:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli instances list
npx @microfeed/cli instances use <instance-name>
```

## Inspect and change content

Use `--json` when another program or agent consumes the result. Read current
content before changing it, validate a create before sending it, and use one
stable idempotency key for every retry of the same logical create:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item list --summary --instance <instance-name> --json
npx @microfeed/cli item get <item-id> --unwrap --instance <instance-name> --json
npx @microfeed/cli item create --input item.json --validate-only \
  --instance <instance-name> --json
npx @microfeed/cli item create --input item.json \
  --idempotency-key <uuid> --verify --instance <instance-name> --json
npx @microfeed/cli item update <item-id> --input item.json \
  --instance <instance-name> --json
```

Create and update accept JSON files, standard input, or common flags. Keep
draft review and publication as separate steps when a person must approve the
result.

## Upload the right kind of media

- `--image-file <path>` sets item cover art or a thumbnail.
- `--attachment-file <path>` sets the item's one main audio, video, document,
  or image attachment and RSS enclosure.
- `media upload <path>` creates standalone media, such as an inline image for
  `content_html`.

For an inline image:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli media upload ./diagram.png --instance <instance-name> --json
```

Insert the returned permanent `media_url` into `content_html`, then create or
update the item. The CLI never prints the short-lived upload URL or forwards
its Bearer credential with file bytes.

## Delete safely

Before deletion, verify the selected saved-instance name and exact item ID.
Interactive use asks for the ID; deterministic automation must repeat it
explicitly:

```console
# Replace <instance-name> with a saved instance name.
npx @microfeed/cli item delete <item-id> --instance <instance-name> \
  --confirm <item-id> --json
```

There is no generic yes flag. A coding agent must obtain approval for the exact
target before running this command.

## Use CI credentials without exposing them

For unattended CI, store `MICROFEED_API_KEY` in the CI secret manager and set
`MICROFEED_URL` or select a saved instance:

```console
MICROFEED_URL=https://feed.example.com npx @microfeed/cli item list --json
```

Do not place the key in the command, a repository file, logs, or an agent
conversation. For raw API calls, advanced search and projections, upload edge
cases, error recovery, and full JSON output contracts, continue with the
[`@microfeed/cli` reference](/microfeed-cli/).
