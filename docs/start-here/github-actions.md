---
title: 2. Use GitHub Actions
description: Fork microfeed and use its manual GitHub Actions workflow to create or update a Cloudflare deployment.
---

Choose this path when you want deployment to run in GitHub's consistent Ubuntu
environment instead of on your computer. You need a
[GitHub account](https://github.com/signup) and a
[Cloudflare account](https://dash.cloudflare.com/sign-up), but you do not need
Node.js, Git, or the microfeed source installed locally.

The workflow is manual-only. Syncing the fork, pushing a commit, or opening a
pull request does not deploy anything. For the simplest installation path,
return to the [AI prompt quick start](../).

## Step 1. Fork microfeed

Open [Fork microfeed](https://github.com/microfeed/microfeed/fork), choose your
personal or organization account, and create the fork. Keep the fork connected
to `microfeed/microfeed` so GitHub can sync later updates from upstream.

Open the fork's **Actions** tab and enable workflows if GitHub asks. GitHub does
not run workflows in a new fork until Actions is enabled, and the manual
workflow must exist on the fork's default branch before the **Run workflow**
button appears.

## Step 2. Add the deployment settings

In your fork, open **Settings → Secrets and variables → Actions**. Add these
four values:

| Name | GitHub setting | When it is needed | What to enter |
| --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | Every deployment | The full ID of the Cloudflare account that will own the site. [Find and copy the account ID in Cloudflare](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/). This is not an API token; it pins the workflow to the intended account. |
| `MICROFEED_ADMIN_PASSWORD` | Repository secret | Creating a new instance only | A 12–128 character password for the microfeed Admin dashboard. This is not your Cloudflare password. |
| `MICROFEED_WORKER_NAME` | Repository variable | Every deployment, unless entered when starting the workflow | A unique name containing 1–63 letters, numbers, or hyphens, with no leading or trailing hyphen. This becomes the Cloudflare Worker name. |
| `MICROFEED_ADMINISTRATOR_EMAIL` | Repository variable | Creating a new instance | The email address that will sign in to the microfeed Admin dashboard. If omitted, the workflow uses the authenticated Cloudflare login email. |

GitHub secrets are for the values that should be masked from workflow logs.
The Worker name and administrator email are ordinary configuration, so put
them on the **Variables** tab. You can override either variable in the Run
workflow form without changing the saved value.

The workflow never asks you to create or paste a Cloudflare API token. It uses
a temporary Cloudflare browser authorization and deletes the local credential
from the hosted runner when the job finishes.

## Step 3. Run the workflow

1. Open the fork's **Actions** tab.
2. Select **Create or update microfeed**.
3. Select **Run workflow** and choose the trusted branch to deploy.
4. Choose **create** for a new instance or **update** for an existing Worker.
5. Leave the Worker name and administrator email blank to use the repository
   variables, or enter temporary overrides.
6. Select **Run workflow**.

Only deploy a branch whose code and workflow you trust. The selected branch is
allowed to use the configured secrets and receives temporary Cloudflare
permissions during this run.

## Step 4. Authorize Cloudflare

Open the running job and expand the active **Authorize Cloudflare** step. Visit
the displayed Cloudflare verification page and enter its one-time code before
the five-minute deadline.

The verification URL and code are visible to anyone who can read the workflow
log while the code is active. If someone else uses the code first, this run
fails. The `CLOUDFLARE_ACCOUNT_ID` secret is checked before Cloudflare
resources are changed, so authorization from a different account cannot cause
the site to deploy there.

## Step 5. Open the deployed site

After the status checks pass, the workflow run summary shows direct links to
the public site and Admin dashboard. Sign in with the administrator email and
password configured above.

Remove the `MICROFEED_ADMIN_PASSWORD` repository secret after the first
successful creation. Updates do not use it.

## Update microfeed later

Follow [Update with GitHub Actions](/manage/update/github-actions/) to sync and
review your fork, run an update from a trusted branch, authorize Cloudflare,
and verify the result.

Next: [complete the post-deployment checklist](../after-deploy/).
