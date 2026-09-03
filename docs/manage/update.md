---
title: Update microfeed
description: Compare three supported ways to update an existing microfeed deployment.
---

Choose one of the three supported methods below. Each uses the same deployment
engine to apply required migrations, build and deploy the Worker, reconcile
data written during the version switch, and verify the finished site.

An update preserves your existing microfeed content and Cloudflare resources.
It changes the application version running on the selected Worker.

## Compare the update methods

| Method | Best for | Advantages | Tradeoffs |
| --- | --- | --- | --- |
| [1. Use a local AI agent](/manage/update/ai-agent/) | The simplest guided update | Start with one prompt; the agent finds or connects the site, deploys, handles recoverable steps, and verifies the result. | Requires a compatible local Node.js environment and an agent that can use the terminal. |
| [2. Use GitHub Actions](/manage/update/github-actions/) | A consistent hosted environment and a versioned fork | Runs on GitHub's Ubuntu runner without local tools. You explicitly choose the branch, while repository secrets identify the account and Worker. | Requires a configured fork, review of upstream changes, and a new Cloudflare browser authorization for each run. |
| [3. Use @microfeed/cli manually](/manage/update/manual/) | Direct control over the command and source code | Deploy the official release with `npx @microfeed/cli manage`, or deploy an official, forked, or locally modified checkout with `yarn manage`. | Requires a compatible local Node.js environment, and you select and troubleshoot the deployment yourself. |

## Official release or your own source code

`npx @microfeed/cli manage` updates the site to the official microfeed release
bundled with the published CLI. It works from any folder and does not build
code from the current directory.

`yarn manage` builds and deploys the current Git-cloned source directory. Use
it when the intended version is an official microfeed checkout, your own fork,
or a custom repository that retains microfeed's management tooling. Review the
branch and working tree carefully because that local source—not the published
CLI's official release—is what will run on Cloudflare.

GitHub Actions also checks out the branch you select and runs `yarn manage`, so
it deploys the code from that branch in your fork.

## Before updating

Identify the exact microfeed site or Worker you intend to update. If you are
using a Git-cloned source repository, protect any local work and make sure the
checkout contains the version you intend to deploy. If you use GitHub Actions,
review the upstream changes before syncing them into your fork.

## If an update stops

Read the final error before retrying. The management CLI keeps saved state for
resumable resource changes, and the previous Worker version often remains live
when deployment stops before the version switch. Run a status check through
the same method, resolve the reported account, resource, or migration problem,
then retry the update.
