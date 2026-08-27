---
title: Manage your site
description: Update, inspect, protect, back up, migrate, and safely remove a microfeed instance.
---

Run management commands through `npx @microfeed/cli manage` from any folder.
If you have a Git-cloned microfeed source repository with dependencies
installed, `yarn manage` is a shortcut to its local version. The published
launcher keeps saved instance mappings in the platform microfeed configuration
directory; the source repository uses its ignored `.microfeed/` directory.
Cloudflare resources and content remain in your Cloudflare account.

An **instance name** is only the short local label used to select a saved site.
If the Cloudflare terms below are unfamiliar, start with
[How microfeed works](/start-here/concepts/).

## Common tasks

| Outcome | Start here |
| --- | --- |
| Verify the hosted application, database, media, and login | `npx @microfeed/cli manage status` |
| Deploy the latest microfeed release | `npx @microfeed/cli manage deploy` |
| Connect local launcher state to an existing site | `npx @microfeed/cli manage connect` |
| List or select saved sites | `npx @microfeed/cli manage instances` / `npx @microfeed/cli manage use` |
| Add a custom hostname | `npx @microfeed/cli manage domain` |
| Change the current login email or password | Dashboard avatar → **Account settings** |
| Set up, recover, change the path, or disable built-in login | `npx @microfeed/cli manage auth <action>` |
| Add optional Cloudflare Access | `npx @microfeed/cli manage access` |
| Back up or restore a whole site | `npx @microfeed/cli manage snapshot <action>` |
| Plan removal without changing anything | `npx @microfeed/cli manage destroy --dry-run` |

Content integrations are configured inside the dashboard’s **API** area. They
use named API keys and do not reuse the dashboard password or Cloudflare login.

## Safe working habits

- Discover Cloudflare accounts before creating a new instance. Never guess
  when a login can access more than one account.
- Use the exact saved instance name when local state contains several sites.
- Read a dry-run or collision report completely before approving reuse,
  restore, or removal.
- Keep passwords, private setup links, and tokens out of chat, command
  arguments, issue reports, and screenshots.
- Create a snapshot before a high-risk content migration.

The [management CLI reference](/manage-cli/) is authoritative if this
task-oriented guide and an option listing ever appear to differ. Its examples
use the recommended `npx @microfeed/cli manage` prefix.
