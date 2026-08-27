---
title: After deployment
description: Verify, secure, customize, and publish from a new microfeed site.
---

Use this checklist after deployment completes.

## Confirm the site is healthy

Run `npx @microfeed/cli manage status`, or `yarn manage status` from the same
repository clone. Confirm the displayed hosted application, database,
media-storage state, and dashboard protection match what you expected.

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
with a coding agent, first [enable API access and connect the
CLI](/automation/cli/), then ask the agent to use the official
[`@microfeed/cli`](https://www.npmjs.com/package/@microfeed/cli). Inside a
clone, the agent should run `yarn microfeed`; elsewhere it can use the
published package. You remain responsible for browser authorization and
approval of destructive actions. Delete or unpublish the test when finished.

Next: [compare the dashboard and agent publishing workflows](/dashboard/publish/).

## Save the local connection

The clone-free launcher stores instance connections in the platform microfeed
configuration directory, separately from its replaceable cache. A repository
clone instead uses its ignored `.microfeed/` directory. Keep either workspace
on a trusted computer; the read-only `connect` workflow can reconnect to an
existing compatible microfeed Worker when local state is unavailable.

## Optional next steps

- [Add a custom domain or Cloudflare Access](/manage/domains-and-access/).
- [Learn the dashboard](/dashboard/).
- [Enable the authenticated API](/api/authentication/) for an integration.
- [Choose an API, webhook, or CLI automation workflow](/automation/).
- [Create a portable snapshot](/manage/backups-and-migrations/).
