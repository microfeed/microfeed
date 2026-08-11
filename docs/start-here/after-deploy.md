---
title: After deployment
description: Verify, secure, customize, and publish from a new microfeed site.
---

Use this checklist after `yarn manage init` completes.

## Confirm the site is healthy

Run `yarn manage status` from the same repository clone. Confirm the displayed
hosted application, database, media-storage state, and dashboard protection
match what you expected.

Open these public addresses:

- `/` for the website.
- `/rss/` for RSS.
- `/json/` for JSON.

An empty new feed is normal.

## Sign in and personalize the channel

Open the dashboard URL printed by the CLI. Then:

1. Add a channel title, description, image, and publisher details.
2. Review the **Site access** mode: Public, Headless, or Offline.
3. Choose a public theme and inspect the website, RSS, and JSON links.
4. If R2 is enabled, upload a small image to test media storage.

## Publish a test item

Create a clearly labeled test item, preview its public page, and check the RSS
and JSON feeds. You can publish it yourself in the Admin dashboard. To publish
with a coding agent, first [enable API access and connect the CLI](/api/authentication/),
then ask the agent to use the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli). Inside this
clone, the agent should run `yarn microfeed`; you remain responsible for
browser authorization and approval of destructive actions. Delete or unpublish
the test when finished.

Next: [compare the dashboard and agent publishing workflows](/dashboard/publish/).

## Save the local connection

The clone’s ignored `.microfeed/` directory remembers the instance connection.
Keep the clone on a trusted computer. If you use a different clone later, the
read-only `yarn manage connect` workflow can reconnect to an existing compatible
microfeed Worker.

## Optional next steps

- [Add a custom domain or Cloudflare Access](/manage/domains-and-access/).
- [Learn the dashboard](/dashboard/).
- [Enable the authenticated API](/api/authentication/) for an integration.
- [Create a portable snapshot](/manage/backups-and-migrations/).
