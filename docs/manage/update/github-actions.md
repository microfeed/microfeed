---
title: 2. Use GitHub Actions
description: Update an existing microfeed Worker from a manual GitHub Actions workflow.
---

Use the manual **Create or update microfeed** workflow when you want the update
to run in GitHub's consistent Ubuntu environment. It uses temporary Cloudflare
browser authorization rather than a Cloudflare API token.

Before continuing, configure your fork and its `CLOUDFLARE_ACCOUNT_ID` and
`MICROFEED_WORKER_NAME` repository secrets using the
[GitHub Actions installation guide](/start-here/github-actions/).

## 1. Sync and review your fork

Sync your fork with `microfeed/microfeed`, then review the incoming changes.
The branch selected in the workflow receives access to the configured secrets
and temporary Cloudflare permissions, so deploy only code and workflows you
trust.

<img width="961" height="451" alt="Screenshot 2026-09-03 at 9 48 58 AM" src="https://github.com/user-attachments/assets/a2f79c51-527d-4e79-a447-242e95c5260e" />


## 2. Run the update

1. Open the fork's **Actions** tab.
2. Select **Create or update microfeed**.
3. Select **Run workflow** and choose the trusted branch to deploy.
4. Change the operation from the default **create** to **update**.
5. Select **Run workflow**. The workflow updates the existing Worker named by
   the `MICROFEED_WORKER_NAME` repository secret.

<img width="1647" height="568" alt="Screenshot 2026-09-03 at 9 52 08 AM" src="https://github.com/user-attachments/assets/bdfc2f64-61d2-4f52-8ea7-1d49580497e4" />


The `MICROFEED_ADMINISTRATOR_EMAIL` and `MICROFEED_ADMIN_PASSWORD` secrets are
not used for an update. Remove them after the first successful installation if
this fork will only update the existing site.

## 3. Authorize Cloudflare

Open the running job and expand **Authorize Cloudflare**. Visit the displayed
Cloudflare verification page and enter its one-time code before it expires.

<img width="1284" height="874" alt="Screenshot 2026-09-03 at 9 44 49 AM" src="https://github.com/user-attachments/assets/374b16df-14e2-4569-a4ba-4a199e7d2070" />

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
