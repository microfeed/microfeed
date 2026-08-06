---
title: Manage your site
description: Update, inspect, protect, back up, migrate, and safely remove a microfeed instance.
---

Run management commands from the local microfeed repository clone connected to
the site. The ignored `.microfeed/` directory stores the instance mapping; the
Cloudflare resources and content remain in your Cloudflare account.

## Common tasks

| Outcome | Start here |
| --- | --- |
| Verify the Worker, database, media, and login | `yarn manage status` |
| Deploy current repository code | `yarn manage deploy` |
| Connect a new clone to an existing site | `yarn manage connect` |
| List or select saved sites | `yarn manage instances` / `yarn manage use` |
| Add a custom hostname | `yarn manage domain` |
| Manage built-in dashboard login | `yarn manage auth <action>` |
| Add optional Cloudflare Access | `yarn manage access` |
| Back up or restore a whole site | `yarn manage snapshot <action>` |
| Plan removal without changing anything | `yarn manage destroy --dry-run` |

Content integrations are configured inside the dashboard’s **API** area. They
use named API keys and do not reuse the dashboard password or Cloudflare login.

## Safe working habits

- Discover Cloudflare accounts before creating a new instance. Never guess
  when a login can access more than one account.
- Use the exact saved instance name for multi-site clones.
- Read a dry-run or collision report completely before approving reuse,
  restore, or removal.
- Keep passwords, private setup links, and tokens out of chat, command
  arguments, issue reports, and screenshots.
- Create a snapshot before a high-risk content migration.

The [`yarn manage` command reference](/manage-cli/) is authoritative if this
task-oriented guide and an option listing ever appear to differ.
