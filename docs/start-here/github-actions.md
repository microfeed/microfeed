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

<img width="1656" height="646" alt="Screenshot 2026-09-03 at 9 36 38 AM" src="https://github.com/user-attachments/assets/41593e4e-2920-473c-a0c9-61c8d796dec7" />


## Step 2. Add four repository secrets

In your fork, open **Settings → Secrets and variables → Actions**. Add these
four repository secrets on the **Secrets** tab:

| Secret name | When it is needed | What to enter |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Every deployment | The full ID of the Cloudflare account that will own the site. [Find and copy the account ID in Cloudflare](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/). This is not an API token; it pins the workflow to the intended account. |
| `MICROFEED_WORKER_NAME` | Every deployment | A unique name containing 1–63 letters, numbers, or hyphens, with no leading or trailing hyphen. This becomes the Cloudflare Worker name. |
| `MICROFEED_ADMINISTRATOR_EMAIL` | Creating a new instance | The email address that will sign in to the microfeed Admin dashboard. |
| `MICROFEED_ADMIN_PASSWORD` | Creating a new instance | A 12–128 character password for the microfeed Admin dashboard. This is not your Cloudflare password. |

Using one GitHub setting type keeps setup simple. GitHub masks these values in
workflow logs. The account ID and Worker name are identifiers rather than
passwords, but store them as secrets here so all four values are added and
managed in the same place.

The workflow never asks you to create or paste a Cloudflare API token. It uses
a temporary Cloudflare browser authorization and deletes the local credential
from the hosted runner when the job finishes.

## Step 3. Run the workflow

1. Open the fork's **Actions** tab.
2. Select **Create or update microfeed**.
3. Select **Run workflow** and choose the trusted branch to deploy.
4. Keep the default **create** selection for a new instance, or choose
   **update** for the existing Worker named by the `MICROFEED_WORKER_NAME`
   secret.
5. Select **Run workflow**.

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

After the first successful creation, remove the `MICROFEED_ADMIN_PASSWORD` and
`MICROFEED_ADMINISTRATOR_EMAIL` secrets if this fork will only update the
existing site. Updates use only `CLOUDFLARE_ACCOUNT_ID` and
`MICROFEED_WORKER_NAME`.

## Update microfeed later

Follow [Update with GitHub Actions](/manage/update/github-actions/) to sync and
review your fork, run an update from a trusted branch, authorize Cloudflare,
and verify the result.

Next: [complete the post-deployment checklist](../after-deploy/).
