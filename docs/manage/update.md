---
title: Update microfeed
description: Bring a connected production instance to the latest source and verify the deployment.
---

Use the published launcher from any folder. If you already have a Git-cloned
microfeed source repository connected to the intended site, you may instead
use its local `yarn manage` shortcut.

## Recommended: ask your coding agent

Open a local coding agent and use a prompt that names the saved site or Worker
when you know it:

```text
Update the microfeed site <site-url> to the latest release. Start by running
`npx @microfeed/cli manage`, connect the existing site if needed, deploy the
update, and continue until `status` verifies the site.
```

The launcher verifies and copies its exact bundled release into a private
cache. The agent discovers
saved and compatible existing sites, asks before choosing among candidates,
connects only if needed, deploys through the same management engine, and
runs a status check. Complete any Cloudflare browser handoffs it requests.

## Create or update with GitHub Actions

The repository includes an experimental manual workflow for creating or
updating microfeed from GitHub's consistent Ubuntu environment. It uses
Cloudflare's device authorization flow, so you approve the requested access in
your browser without creating or pasting an API token.

The workflow file must exist on the repository's default branch before GitHub
shows its **Run workflow** control. Once it is available:

1. For a new instance, first create a `MICROFEED_ADMIN_PASSWORD` repository
   secret under **Settings → Secrets and variables → Actions**. This is the
   password you will use for the microfeed dashboard, not a Cloudflare token.
   Use 12–128 characters. Existing-instance updates do not use this secret.
2. Open the repository's **Actions** tab and select **Create or update
   microfeed**.
3. Choose the trusted branch you want to deploy and select **create** or
   **update**.
4. Enter the Worker name. If your Cloudflare login can access more
   than one account, also enter its full account ID.
5. For a new instance, the dashboard email defaults to the authenticated
   Cloudflare login email. Enter a different administrator email only when you
   want the two identities to differ.
6. Start the workflow, open the active **Authorize Cloudflare** step, and follow
   the displayed URL and one-time code. Keep the run open until authorization
   finishes.
7. The workflow collision-checks and creates a new site, or connects and
   updates an existing site. It then verifies status and logs out of Cloudflare.

For a new instance, the D1 database and R2 bucket names are derived from the
lowercase Worker name. Initialization stops instead of reusing or overwriting
same-named resources.

To avoid retyping non-secret target information, add either of these in
**Settings → Secrets and variables → Actions → Variables**:

- `MICROFEED_WORKER_NAME` for the Worker's name.
- `MICROFEED_CLOUDFLARE_ACCOUNT_ID` for the full account ID when the login can
  access multiple accounts.

Values typed in the Run workflow form override the corresponding repository
variable. The account ID identifies a Cloudflare workspace; it is not a
credential. If neither source supplies a Worker name, the workflow stops before
Cloudflare authorization.

The workflow never reads or writes a Cloudflare token in GitHub secrets. It
stores Wrangler's temporary OAuth credential and microfeed connection state
only under the hosted runner's temporary directory, excludes both from caches,
and runs `wrangler logout` even after a later step fails. Future deployments
therefore require another browser approval, while the Worker name and optional
account ID can remain as repository variables.

The dashboard password secret is available only to the new-instance step and
GitHub masks it in logs. It is still sensitive: the selected branch executes
while the secret is available, so do not authorize or initialize from
unreviewed code.

Only authorize a ref whose code and workflow you trust: the selected source is
what receives the temporary Cloudflare permissions and is deployed. New-site
mode creates a Worker, D1 database, R2 bucket when available, Worker secrets,
and the first dashboard login. Remove `MICROFEED_ADMIN_PASSWORD` from the
repository after initialization succeeds; future updates do not use it.

## Update from a Git-cloned source repository

First run `git status` and protect any local work. Then fetch and inspect
upstream changes using your normal Git workflow. Once the source repository
contains the version you intend to run:

```console
yarn install --immutable
yarn manage deploy
yarn manage status
```

`deploy` applies database migrations, completes required data normalization
(including stored plain text for item search), runs project checks, builds the
Worker, tags the deployed version with the source commit, deploys, reconciles
data written during the version switch, and verifies it.

## If the source repository is not connected

Do not initialize over an existing Worker. Connect first:

```console
yarn manage connect --worker <worker-name> --instance <local-name>
```

The connect operation is read-only in Cloudflare: it verifies a compatible
microfeed Worker and saves local connection state.

## Recovery

If deployment stops, read the final error before retrying. The CLI keeps saved
state for resumable resource changes. If the site still serves the previous
version, run `npx @microfeed/cli manage status` and resolve the reported
account, resource, or migration problem before another deploy.
