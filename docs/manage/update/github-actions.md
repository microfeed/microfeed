---
title: 2. Use GitHub Actions
description: Update an existing microfeed Worker from a manual GitHub Actions workflow.
---

Use the manual **Create or update microfeed** workflow when you want the update
to run in GitHub's consistent Ubuntu environment. It uses temporary Cloudflare
browser authorization rather than a Cloudflare API token.

Before continuing, configure your fork, Cloudflare account ID, and Worker name
using the [GitHub Actions installation guide](/start-here/github-actions/).

## 1. Sync and review your fork

Sync your fork with `microfeed/microfeed`, then review the incoming changes.
The branch selected in the workflow receives access to the configured secrets
and temporary Cloudflare permissions, so deploy only code and workflows you
trust.

## 2. Run the update

1. Open the fork's **Actions** tab.
2. Select **Create or update microfeed**.
3. Select **Run workflow** and choose the trusted branch to deploy.
4. Choose **update**.
5. Leave the Worker name blank to use `MICROFEED_WORKER_NAME`, or enter the
   exact existing Worker name as an override.
6. Select **Run workflow**.

The administrator email and `MICROFEED_ADMIN_PASSWORD` are not used for an
update. Remove the password secret after the first successful installation if
you have not already done so.

## 3. Authorize Cloudflare

Open the running job and expand **Authorize Cloudflare**. Visit the displayed
Cloudflare verification page and enter its one-time code before it expires.

The verification URL and code are visible to anyone who can read the workflow
log while the code is active. If someone else uses the code first, the run
fails. The `CLOUDFLARE_ACCOUNT_ID` secret pins deployment to the intended
account, so authorization from another account cannot deploy the update there.

## 4. Verify the update

Keep the job page open until verification finishes. The workflow summary shows
direct links to the verified public site and Admin dashboard.

The workflow is manual-only. Syncing or pushing the fork does not deploy by
itself. A future update requires another explicit run and Cloudflare browser
authorization.
