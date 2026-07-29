</br>
</br>
<div align="center">
  <a href="https://www.microfeed.org/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/1719237/210119945-50e1d444-2d12-43d2-a96d-65bdbccecb70.png">
    <img src="https://user-images.githubusercontent.com/1719237/207514210-99ddbd03-f8f0-410a-96c8-80da1afb804d.png" width="280" alt="Logo"/>
  </picture>
  </a>
</div>

<h1 align="center">microfeed: a lightweight cms self-hosted on cloudflare</h1>

  <p align="center">
    <a href="https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug"><b>Report Bug</b></a>
    ·
    <a href="https://github.com/microfeed/microfeed/discussions/new?category=ideas"><b>Request Feature</b></a>
    ·
    <a href="mailto:support@microfeed.org"><b>Email Us Privately</b></a>
  </p>

Welcome to microfeed, a lightweight content management system (CMS) self-hosted on Cloudflare.
With microfeed, you can easily publish a variety of content such as audios, videos, photos, documents, blog posts,
and external URLs to a feed in the form of web, RSS, and JSON. It's the perfect solution for tech-savvy individuals who
want to self-host their own CMS without having to run their own servers.

microfeed is built by [Listen Notes](https://www.listennotes.com/) and is hosted on Cloudflare's [Workers](https://workers.cloudflare.com/),
[R2](https://www.cloudflare.com/products/r2/), and [D1](https://developers.cloudflare.com/d1/).

If you have any questions or feedback, please don't hesitate to reach out to us at support@microfeed.org. We'd love to hear from you!

## 📚 Table of contents
[![CI](https://github.com/microfeed/microfeed/actions/workflows/ci.yml/badge.svg)](https://github.com/microfeed/microfeed/actions/workflows/ci.yml)
[![Email us](https://img.shields.io/badge/Email-support%40microfeed.org-blue)](mailto:support@microfeed.org)
[![stability-alpha](https://img.shields.io/badge/stability-alpha-f4d03f.svg)](https://www.microfeed.org/i/introducing-microfeed-self-hosted-cms-on-cloudflare-opensource-serverless-free-uhbQEmArlC2/)

* [⭐️ How it works](#%EF%B8%8F-how-it-works)
* [🚀 Installation](#-installation)
  * [Method 1: Cloudflare Web UI (human)](#method-1-cloudflare-web-ui-human)
  * [Method 2: yarn admin CLI (human)](#method-2-yarn-admin-cli-human)
  * [Method 3: AI agent using a repository skill](#method-3-ai-agent-using-a-repository-skill)
  * [Manage CLI and agent deployments](#manage-cli-and-agent-deployments)
    * [Multiple local and Cloudflare instances](#multiple-local-and-cloudflare-instances)
    * [Safely remove a deployment](#safely-remove-a-deployment)
    * [Preview deployment](#preview-deployment)
    * [Migrating an existing Pages installation](#migrating-an-existing-pages-installation)
    * [Custom domain and optional extra protection](#custom-domain-and-optional-extra-protection)
    * [Manage the admin login](#manage-the-admin-login)
  * [Done. Start publishing](#done-start-publishing)
  * [Update to the latest version of microfeed](#update-to-the-latest-version-of-microfeed)
* [💻 FAQs](#-faqs)
* [💪 Contributions](#-contributions)
  * [Run microfeed on local](#run-microfeed-on-local)
* [🛡️ License](#%EF%B8%8F-license)

## ⭐️ How it works

Since the 1990s, a significant portion of the web has been powered by feeds.
People (and bots) publish items to a feed, and others can subscribe to that feed to receive new content.

microfeed makes it easy for individuals to self-host their own feed on Cloudflare, including but not limited to
* a podcast feed of audios
* a blog feed of posts
* an Instagram-like feed of images (e.g., [llamacorn.listennotes.com](https://llamacorn.listennotes.com/), [brand-assets.listennotes.com](https://brand-assets.listennotes.com/))
* a YouTube-like feed of videos
* a personal website with custom links
* a content curation feed of external news article urls
* a marketing site with updates and press coverage (e.g., [microfeed.org](https://www.microfeed.org/))
* a headless cms with a GUI dashboard and a public json feed (e.g., [microfeed.org/json](https://www.microfeed.org/json/) with OpenAPI spec in [YAML](https://www.microfeed.org/json/openapi.yaml) and [HTML](https://www.microfeed.org/json/openapi.html))
* a list of domain names for sale (e.g., [ListenHost.com](https://www.listenhost.com/)...)
* a website for an entire book (e.g., [The Art of War](https://the-art-of-war.microfeed.org/))
* a changelog website (e.g., [changelog.listennotes.com](https://changelog.listennotes.com/))
* ...

microfeed uses Cloudflare [Workers](https://workers.cloudflare.com/) to host and run the code,
[R2](https://www.cloudflare.com/products/r2/) to host and serve media files,
[D1](https://developers.cloudflare.com/d1/) to store metadata,
and a built-in email and password login to protect the admin dashboard.
Cloudflare provides very generous free usage quotas, making it an affordable solution for personal or small business use.
While you will still need to pay for a domain name, hosting microfeed on Cloudflare is essentially free.

With microfeed, you can publish a variety of content such as audios, videos, photos, documents, blog posts,
and external URLs to a customizable website, an RSS feed, and a [JSON feed](https://www.jsonfeed.org/).
Check out some examples of microfeed in action:
* Web feed: [https://llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Rss feed: [https://llamacorn.listennotes.com/rss/](https://llamacorn.listennotes.com/rss/)
* Json feed: [https://llamacorn.listennotes.com/json/](https://llamacorn.listennotes.com/json/)

microfeed provides a simple yet powerful admin dashboard that makes it easy to add items to the feed,
upload media files, and customize web page styles. If you've used WordPress before, you'll find it familiar.

![image-6d056193c81c0b8f5de0503f5af18116](https://user-images.githubusercontent.com/1719237/209486588-00acefe0-dd51-4bfc-aed7-1f63850aa720.png)

[Back to 📚TOC](#-table-of-contents)

## 🚀 Installation

microfeed supports three ways to deploy to Cloudflare. Choose based on who
drives the setup and where you prefer to work:

| | Cloudflare Web UI | `yarn admin` CLI | AI agent + repository skill |
| --- | --- | --- | --- |
| Driven by | A person clicking through Cloudflare | A person running terminal commands | A local AI agent following this repository's deployment skill |
| Best for | No-terminal setup and GitHub-based updates | Full control, upgrades, previews, and migrations | Conversational setup where the agent handles commands and verification |
| Local clone | Not required | Required | Required |
| GitHub fork | Required | Not required | Not required |
| Cloudflare changes | Cloudflare's web setup and Workers Builds | Performed by `yarn admin` | Performed by `yarn admin`; the skill guides the agent |
| Human handoffs | Cloudflare and GitHub sign-in, setup form | Browser authorization, prompts, password page | Approvals, browser authorization, account choice when needed, password page |

All three methods create the same kind of microfeed site. None requires you to
create Cloudflare API keys, R2 credentials, or GitHub secrets.

### Method 1: Cloudflare Web UI (human)

Choose this method if you want to create a new microfeed installation without
using a terminal or an AI agent. You do the setup yourself by clicking through
GitHub and Cloudflare. First create your own GitHub fork so you can bring in
future microfeed updates with GitHub's **Sync fork** button.

1. **[Fork microfeed on GitHub](https://github.com/microfeed/microfeed/fork).**
   Sign in to GitHub, keep the suggested settings, and select **Create fork**.
   If this is your first fork, see GitHub's
   [Fork a repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo?tool=webui)
   guide.
2. **Deploy your fork to Cloudflare.**

   Cloudflare uses a few infrastructure terms on its setup screen. You can keep
   every suggested value:

   * **Worker:** your hosted microfeed application. Its name becomes part of
     the free Cloudflare web address, so use the short site name you want.
   * **Content database (D1):** stores posts, channels, settings, and the
     administrator account.
   * **Media storage (R2):** stores uploaded images, audio, video, and
     documents.

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/)

   Sign in to Cloudflare, choose your GitHub account, and select
   `<your-github-account>/microfeed` from the repository list. Do not select
   **Clone a public repository via Git URL**—that creates a separate copy
   instead of using your fork. When Cloudflare asks which branch to deploy,
   use your fork's default branch.

   Before selecting **Deploy**, expand the build settings and confirm these
   two values. Cloudflare normally fills them from `package.json`, but some
   repository-import paths may leave them blank or use a generic default:

   | Setting | Required value | Why microfeed needs it |
   | --- | --- | --- |
   | **Build command** | `yarn build` | Creates the Astro application that Cloudflare deploys. |
   | **Deploy command** | `yarn deploy` | Applies database updates, deploys microfeed, finishes the administrator login setup, and verifies the site. |

   Do not keep `npx wrangler deploy` as the deploy command. That generic
   fallback skips microfeed's build, database updates, and setup checks.

If your fork does not appear, give the
[Cloudflare Workers & Pages GitHub App access to the repository](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/#manage-access),
then return to Cloudflare and refresh the repository list.

Cloudflare guides you through creating the Worker, D1 database, and R2 bucket
used by microfeed. It connects your fork to Cloudflare Workers Builds, so
changes pushed to the deployment branch are built and deployed automatically.

If a deployment fails with
`The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found`,
open the Worker's **Settings → Builds**, set **Build command** to `yarn build`
and **Deploy command** to `yarn deploy`, save, and retry the build. The error
means Cloudflare used its generic deploy command without building Astro first;
it does not mean that your Worker, database, or media storage is damaged.

During setup, enter the email and password you want to use for the microfeed
admin dashboard. The email does not need to match your Cloudflare account and
is not shown publicly. microfeed securely creates the login, stores only a
one-way password hash, and removes the temporary setup values automatically.
After deployment, sign in at `/admin/`.

[Back to 📚TOC](#-table-of-contents)

### Method 2: `yarn admin` CLI (human)

Choose this method when you want to run the guided setup yourself from a local
terminal. It includes the recommended built-in admin login and supports
upgrades, multiple installations, preview environments, custom domains, and
Cloudflare Pages migrations.

For every command, option, side effect, safety rule, and example, see the
canonical [`yarn admin` command reference](docs/admin-cli.md). You can also run
`yarn admin help <command>` from the clone for matching terminal help.

The `yarn admin` command is included in this repository—it is not a command
installed on your computer globally. Before you can use it, install
[Git](https://git-scm.com/downloads) and
[Node.js 24](https://nodejs.org/en/download), then clone a copy of microfeed
to your computer:

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install
yarn admin accounts
yarn admin setup
```

Run future `yarn admin` commands from this same `microfeed` folder.

`yarn admin accounts` opens Cloudflare's sign-in page when needed and lists the
accounts available to that login without creating or changing any Cloudflare
resource. If several accounts are available, choose the one where you want the
site to live. `yarn admin setup` then asks for the site settings and explains
the Cloudflare resources before creating them.

The installer also asks how to protect the admin dashboard:

* **Set up admin login (Recommended):** Enter the email you will use to sign in
  as administrator. After deployment, the installer opens a private one-time
  page where you choose the password. The email does not need to match your
  Cloudflare account and is not shown publicly.
* **Skip authentication:** Leave the admin dashboard public until you protect
  it with [Cloudflare Zero Trust Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/). Anyone on the internet can create,
  edit, or delete content while it is unprotected.

The admin address defaults to `/admin/`, and you can choose a different
address if you prefer.

When deployment finishes, the installer prints a single-use password link that
expires after 30 minutes and normally opens it automatically. Use `--no-open`
to print it without opening a browser. A new setup or reset link immediately
invalidates the previous one. If setup is interrupted, run the same command
again to continue; microfeed never deletes existing resources during a retry.

New installations upload to and serve media through the Worker, so you do not
need to configure public R2 access, CORS, an R2 custom domain, or S3
credentials.

You can supply the default Worker name without a prompt:

```console
CLOUDFLARE_PROJECT_NAME=my-feed yarn admin setup
```

For later deployments and diagnostics, use:

```console
yarn admin deploy
yarn admin status
```

[Back to 📚TOC](#-table-of-contents)

### Method 3: AI agent using a repository skill

Choose this method when you want a local AI coding agent to drive the same
trusted `yarn admin` workflow for you. The agent is the guide and operator; it
does not deploy through a separate API, plugin, MCP server, or hand-written
Cloudflare commands.

This repository includes the `deploy-microfeed` skill under
`.agents/skills/`. A compatible local coding agent can follow it; Codex
discovers it automatically when you open this clone and ask to deploy,
publish, update, or configure microfeed. You can also invoke it explicitly:

```text
Use $deploy-microfeed to deploy a new site called personal-feed.
Use me@example.com to sign in as administrator.
```

The agent:

* checks the trusted working tree, Node.js, Corepack, and locked dependencies
* runs `yarn admin accounts --json` before any Cloudflare resource is changed
* asks you to choose when your login can access several Cloudflare accounts
* explains the site, database, media storage, login, and optional domain in
  plain language before requesting approval
* runs setup with the exact account and non-secret choices you approved
* relays the private one-time password page and verifies the finished site with
  `yarn admin status`

You only need to:

* approve dependency downloads and the described Cloudflare changes
* finish Cloudflare authorization in your browser
* choose the Cloudflare account when more than one is available
* open the private one-time page and choose the dashboard password yourself

Never send a Cloudflare token, dashboard password, or private password link to
the agent. The agent must never use the unsafe `--admin-password` option. It
may relay the one-time link printed by the trusted CLI, but it must not ask you
to paste that link or your password back into chat. The dashboard returns HTTP
403 until you finish creating the password.

This workflow requires a local agent with access to the clone and a browser
that can complete Wrangler's local Cloudflare callback. Hosted/headless agents
and unattended API-token deployment are not supported. No separately installed
skill, Cloudflare plugin, or MCP server is required.

[Back to 📚TOC](#-table-of-contents)

### Manage CLI and agent deployments

Methods 2 and 3 share the same saved configuration and commands because the
agent method always operates through `yarn admin`. You can start with an agent
and later run the CLI yourself—or do the reverse—without creating a different
kind of installation.

#### Multiple local and Cloudflare instances

One clone can keep any number of independent microfeed instances. An instance
can be:

* **Local only:** Runs on your computer with simulated D1 and R2 resources and
  has no Cloudflare deployment.
* **Cloudflare — managed here:** Has saved configuration in this clone and can
  be deployed or administered from it.
* **Cloudflare — available to connect:** Is an existing compatible Worker in
  your Cloudflare account that has not been connected to this clone yet.

Create as many isolated local-only instances as you need:

```console
yarn admin setup --local --instance personal
yarn admin setup --local --instance company
```

During local setup, the built-in email and password login is optional. You can
enable it to try the same sign-in flow used in production, or skip it and open
the local admin dashboard directly. Add it later for a specific instance with:

```console
yarn admin auth setup --local --instance personal
```

For production, strongly protect `/admin/` with the built-in login,
[Cloudflare Zero Trust Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/),
or both. Skipping the built-in login during local setup does not change any
production authentication setting.

Create new Cloudflare deployments with the same naming convention:

```console
yarn admin setup --instance art-of-war
yarn admin setup --instance company-changelog
```

To manage an existing microfeed Worker without deploying it again, run:

```console
yarn admin connect
```

The command signs in through Wrangler when necessary, discovers compatible
Workers, verifies the selected Worker's public microfeed identity, and saves
its existing bindings and settings locally. Connecting is read-only: it does
not deploy, copy data, or change any Cloudflare resource.
If your Wrangler login can access several accounts, both `connect` and
`instances` accept `--account-id <id>` to limit discovery.

List every saved instance plus compatible Workers available to connect, or
select the default saved instance:

```console
yarn admin instances
yarn admin use art-of-war
```

The instance list keeps local-only instances in their own section and groups
Cloudflare instances by account. When Wrangler exposes the information, each
Cloudflare section also shows the active local auth profile, login email, and
account ID.

The active instance is used by commands that do not specify a name. To target
one explicitly:

```console
yarn admin deploy --instance company-changelog
yarn admin status --instance art-of-war
yarn admin domain --instance art-of-war
yarn admin auth --instance company-changelog
```

Every saved instance uses its own gitignored directory under
`.microfeed/instances/<name>/`. Local-only instances keep separate D1 data, R2
media, admin accounts, development secrets, and generated Wrangler
configuration. A connected Cloudflare instance also gets its own local
development sandbox, but that sandbox is separate from its production D1 and
R2 resources.

Local and production content never synchronize automatically. Running
`yarn dev --instance company-changelog` uses that Cloudflare instance's
configuration locally, but it does not download, access, or modify production
data. Deploying remains a separate explicit operation.

Only saved local-only and managed Cloudflare instances can be selected with
`yarn admin use`. Connect an available Worker first. Cloudflare-only commands
also stop with guidance when a local-only instance is selected.

If this repository already has the older single-instance configuration,
microfeed imports it automatically as the first named instance without
changing anything in Cloudflare.

[Back to 📚TOC](#-table-of-contents)

#### Safely remove a deployment

First print a read-only plan for the exact saved site:

```console
yarn admin destroy --instance art-of-war --dry-run
```

The plan shows the Cloudflare account, public address, hosted application,
content database ID and name, media bucket, and whether each data resource will
be deleted or preserved. It also prints unwrapped Cloudflare dashboard links
for manually inspecting the application, database, and media storage before
continuing. Each account-wide page is paired with the exact resource name and
its expected state after removal:

```text
https://dash.cloudflare.com/<account-id>/workers-and-pages
https://dash.cloudflare.com/<account-id>/workers/d1
https://dash.cloudflare.com/<account-id>/r2/overview
```

The plan also calls out deletion of the local instance folder, including its
saved configuration and its separate local development database and media
sandbox.

After exporting anything you need and checking those links, run:

```console
yarn admin destroy --instance art-of-war
```

The interactive command requires you to review the plan and type the exact site
name. Automation can use `--confirm art-of-war` only after presenting the same
dry-run plan and receiving explicit approval; `--yes` is deliberately rejected.

Destruction stops the hosted application first, verifies that it is gone, then
permanently deletes the site's content database and every object in its media
bucket. It verifies each removal and deletes the local instance folder last. If
a step fails, rerun the same command to resume from the recorded progress. A
replacement resource, unexpected custom domain, changed installation identity,
or changed database ID causes the command to stop instead of guessing.

Use `--keep-data` to delete the hosted application while preserving its
database and media bucket. Resources marked as reused are always preserved,
even without that option. If a preview exists, destroy it first:

```console
yarn admin destroy --preview --instance art-of-war --dry-run
yarn admin destroy --preview --instance art-of-war
```

The command does not inspect or change Cloudflare Zero Trust or SSL settings.
At the end, it prints the same Workers & Pages, D1, and R2 links again. Open each
page, search for the displayed exact name, and confirm that it is absent—or
still present when `--keep-data` or a shared/reused resource requires
preservation. Cloudflare's lists can take a moment to refresh.

[Back to 📚TOC](#-table-of-contents)

#### Preview deployment

The guided CLI can create a separate preview environment that behaves like
production without changing the production Worker or its database.

After setting up production, create the preview environment once:

```console
yarn admin setup --preview
```

The CLI creates a separate preview Worker and D1 database. It reuses the
production R2 bucket, but keeps uploaded files separate:

* production media is stored under `production/`
* preview media is stored under `preview/`

Older project-prefixed object keys remain valid after an upgrade. Existing
D1 media paths and R2 objects are not renamed or migrated; only new uploads
use the shorter environment-only prefix.

The preview environment does not use or modify the production D1 database.
Its Worker and D1 names default to `<project-name>-preview` and
`<project-name>-preview-db`; the CLI lets you change these names during setup.

For later preview deployments and diagnostics, use the same commands with
`--preview`:

```console
yarn admin deploy --preview
yarn admin status --preview
```

Preview deployments use their own `workers.dev` URL instead of the production
custom domain and have a separate admin login. The setup command asks for its
sign-in email and provides a separate browser password link.

[Back to 📚TOC](#-table-of-contents)

#### Migrating an existing Pages installation

Keep the existing Pages project online while you deploy and verify a separate Worker:

```console
yarn admin migrate-pages
```

Enter the existing Pages project name and choose a different Worker name, defaulting to `<pages-name>-worker`.
The CLI suggests `<pages-name>_feed_db_production` for the existing D1 database and `<pages-name>` for the existing R2 bucket, while allowing custom names.
It asks how to protect the dashboard and lets you choose an optional admin
address, then reuses those resources, applies database migrations, deploys to
`workers.dev`, and verifies the new installation without modifying Pages.

Before changing traffic, verify the website, individual items, JSON Feed, RSS,
sitemap, admin operations, uploads, and existing media. If you use a custom
domain, run:

```console
yarn admin domain
```

If the domain is still attached to Pages, the CLI links directly to that
project's **Custom domains** page and stops without changing anything. Remove
only that custom domain from Pages, which also removes its Pages-managed CNAME,
then run `yarn admin domain` again.

Workers Custom Domains require a Cloudflare-managed zone and cannot coexist
with a CNAME on the same hostname. After the Pages dashboard removal, Wrangler
creates the Worker-managed DNS record during the custom-domain deployment. Your
built-in admin login continues to work after the domain changes. The CLI never
renames, redeploys, deletes, or removes a domain from the Pages project.

If the operating system still has a stale DNS result after cutover, deployment
verification immediately retries the HTTPS identity check through Cloudflare
DNS over HTTPS. A successful fallback avoids waiting for the remaining retries
and does not flush or change the computer's DNS settings. All deployment flows
use the same six-retry exponential backoff schedule: 5, 10, 20, 40, 80, and
160 seconds.

For safety, `yarn admin setup` stops before creating any resource when a Pages project has the requested name.
It asks you to change `CLOUDFLARE_PROJECT_NAME` to a name such as `<pages-name>-worker` and try again.

[Back to 📚TOC](#-table-of-contents)

#### Custom domain and optional extra protection

The guided installer offers to configure a custom domain. If you skip it, you
can add and verify one later with:

```console
yarn admin domain
```

After custom-domain setup:

* Public pages, feeds, media, and APIs use the custom domain.
* The built-in login protects the admin dashboard at its configured address.
* The project's `workers.dev` address is disabled by default. You can enable it
  from [Workers & Pages](https://dash.cloudflare.com/?to=%2F%3Aaccount%2Fworkers-and-pages)
  by selecting the Worker and opening **Settings → Domains & Routes**. A later
  microfeed deployment restores the safer disabled default.

The recommended built-in login is all you need. If you want Cloudflare Access
as a second gate—or skipped the built-in login and need to protect the public
admin dashboard—run:

```console
yarn admin access
```

The command opens the correct Cloudflare page and gives you the hostname and
admin path to enter. This step is optional and does not require another API
token.

[Back to 📚TOC](#-table-of-contents)

#### Manage the admin login

To change the owner email, reset the owner password, or move the dashboard to a
different address, run:

```console
yarn admin auth
```

If you skipped authentication during setup, add the built-in login later with:

```console
yarn admin auth setup
```

`yarn admin auth setup` creates a new first-password link when no administrator
exists. `yarn admin auth reset-password` creates a one-time reset link for the
existing administrator. Completing a reset signs out existing sessions; until
then, the current password continues to work.

Remote automation can instead supply `--admin-password <value>` to production
or preview setup, `auth setup`, or `auth reset-password`. This is intentionally
unsafe because command arguments can appear in shell history, process listings,
agent transcripts, and CI logs. microfeed validates the same 12–128 character
policy, never prints or saves the raw value, and sends only its hash to D1.
Codex never uses this option, and local instances reject it.

To disable the built-in login:

```console
yarn admin auth disable
```

The command first checks whether Cloudflare Access protects the dashboard. It
warns before making the dashboard public, then redeploys only after you
confirm. The existing account and credentials are preserved, so
`yarn admin auth setup` can restore the built-in login later.

Changing the admin address redeploys the Worker and verifies the new address.
The old address returns 404.

[Back to 📚TOC](#-table-of-contents)

### Done. Start publishing

Once you've completed the setup process, your microfeed instance will be ready to use.
You can add, update, or delete items from the admin dashboard.

You can also customize the appearance of the website at Settings / Custom code by editing the raw HTML and CSS:

<img width="1098" alt="Screenshot 2022-12-30 at 7 57 45 PM" src="https://user-images.githubusercontent.com/1719237/210062910-e56135f6-557e-419e-a00d-b25dd391c93d.png">

The HTML code is using [mustache.js](https://github.com/janl/mustache.js) as a templating language, where you can access to variables from Feed Json or Item Json. For example, on our marketing website [microfeed.org](https://www.microfeed.org/)'s home page (Feed Web), we use variables in the html code from [microfeed.org/json/](https://www.microfeed.org/json/), and on [an item's page](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/) (Item Web), we use variables from [${item_url}/json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json).

With the easy access to the json data of a microfeed instance (i.e., [Feed Json](https://www.microfeed.org/json/) and [Item Json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json), you can use it as a headless CMS and build your own client apps to display the content.

[Back to 📚TOC](#-table-of-contents)

### Update to the latest version of microfeed

We will continue to add features and fix bugs in this repository.

If you installed microfeed with the `yarn admin` CLI, open a terminal in your
local `microfeed` folder and run:

```console
git pull --ff-only
corepack enable
yarn install
yarn admin deploy
```

If one clone manages several installations, add `--instance <name>` to deploy
the one you want to update.

If you used the fork-first Deploy to Cloudflare method:

1. Open your microfeed fork on GitHub.
2. Select **Sync fork**, review the available changes, and select
   **Update branch**. See GitHub's
   [Syncing a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
   guide for screenshots and other update methods.
3. Wait for Cloudflare Workers Builds to build and deploy the updated branch
   automatically.

If GitHub reports a conflict, it will ask you to create a pull request to
resolve it. Do not discard your fork's commits or Cloudflare-generated
deployment configuration. Resolve the conflict while keeping your Worker, D1,
and R2 values, or clone your fork and use the local `yarn admin` workflow
instead.

[Back to 📚TOC](#-table-of-contents)

## 💻 FAQs

<details>
<summary><b>How can I track podcast / video / image downloads?</b></summary>

To track podcast, video, or image downloads with microfeed, you can use the tracking URLs feature.
This allows you to set up third-party tracking URLs for your media files, such as those provided by [OP3](https://op3.dev/), [Podtrac](http://analytics.podtrac.com/)...

To set up tracking URLs, you will need to go to Settings / Tracking URLs:
![Screenshot 2023-01-05 at 7 57 02 AM](https://user-images.githubusercontent.com/1719237/210665674-39f9b0a9-1f28-4608-b0cd-c67b8a5c87ec.png)


From there, you can add the third-party tracking URLs that you want to use.
microfeed will automatically add these URLs to the front of the URL for your media files, allowing you to track download statistics.

This is a [common practice in the podcast industry](https://lowerstreet.co/blog/podcast-tracking) and can be a useful way to monitor the performance of your content and understand how it is being consumed by your audience.

</details>

<details>
<summary><b>Why Cloudflare? Isn't it dangerous to trust a for-profit company?</b></summary>

Many individuals and organizations trust and use Cloudflare's services because it has a reputation for providing reliable and effective services.
We ([Listen Notes](https://www.listennotes.com/)) have been using Cloudflare for many years.

It's convenient to manage all things on a one-stop platform like Cloudflare (e.g., DNS, Cache, firewall, running code, CDN, trustless logins...).

microfeed is still in open alpha phase. Cloudflare is the first platform we support.
We may consider supporting other serverless platforms, so you can easily migrate away if needed.
</details>


<details>
<summary><b>What if Cloudflare de-platforms my microfeed instance?</b></summary>

It is important to carefully review the terms of service for any service that you use, including Cloudflare.
It is possible that if you violate the terms of service, the service may take action, such as de-platforming your instance.

To protect against the possibility of being de-platformed, it is a good idea to regularly backup your data from Cloudflare.
This will allow you to recover your contents and potentially migrate them to a different platform if necessary.
It is also a good idea to use your own custom domain, as this will give you more control over your content and make it easier to move your data to a different platform if needed.
</details>


<details>
<summary><b>Why should I use microfeed?</b></summary>

If you are already using Cloudflare and are satisfied with its services, then using microfeed may be a good option for you.

If you don't want to manage your own servers, microfeed can be a convenient alternative that allows you to take advantage of
Cloudflare's infrastructure and security features.

If you don't want to pay for servers, microfeed can be a cost-effective solution, as Cloudflare provides generous free usage quotas.

If you are looking for something new and are interested in exploring different options, microfeed could be a good choice to consider.
It is always a good idea to carefully evaluate any service before using it to ensure that it meets your needs and is a good fit for your use case.
</details>

<details>
<summary><b>How to download / backup data from microfeed / Cloudflare?</b></summary>

microfeed stores data in Cloudflare D1 and R2. Therefore, you'll download two things to backup your microfeed data:
* a sqlite database from [Cloudflare D1](https://developers.cloudflare.com/d1/), including all metadata.
* media files from [Cloudflare R2](https://developers.cloudflare.com/r2/), including audio, image, video...

<b>How to download a sqlite database from D1?</b>

You can use the command line tool `wrangler` to find sqlite database files and download backups:

[https://developers.cloudflare.com/workers/wrangler/commands/#d1](https://developers.cloudflare.com/workers/wrangler/commands/#d1)

<b>How to download media files from R2?</b>

As of Feb 16, 2023, Cloudflare has not provided tools to to batch download all files from a R2 bucket.

You may need to write a script to use [S3-compatible APIs](https://developers.cloudflare.com/r2/data-access/s3-api/api/) to fetch all objects from a specific R2 bucket.

</details>

[Back to 📚TOC](#-table-of-contents)

## 💪 Contributions
We welcome contributions to microfeed!
If you have an idea for a new feature or have found a bug, please [open an issue](https://github.com/microfeed/microfeed/issues/new) in the repository.
If you'd like to submit a fix or new feature, please create a pull request with a detailed description of your changes.

### Run microfeed on local

Pre-requisites: Node.js 24, Corepack, and Wrangler.

Install dependencies and start the Astro development server:

```console
corepack enable
yarn install
yarn admin setup --local --instance personal
yarn dev --instance personal
```

Create another fully isolated local instance by choosing another name:

```console
yarn admin setup --local --instance company
yarn admin use company
yarn dev
```

`yarn admin auth setup --local` remains available as a shortcut: in a fresh
clone it creates the default `local` instance, and for an existing selected
instance it configures that instance's local admin login.

The local setup prompt lets you skip the built-in login. If you skip it, the
local dashboard opens without a sign-in screen; enable it later with
`yarn admin auth setup --local --instance <name>`.

Wrangler provides separate persistent D1 and R2 simulations for every
instance, and microfeed prepares local database migrations automatically.
Admin accounts, content, uploaded media, and development secrets are isolated
between instance names.

You can also run a connected Cloudflare instance locally:

```console
yarn dev --instance company-changelog
```

This selects the deployment's configuration shape while still using its
isolated local D1 and R2 simulations. It never accesses, copies, or changes
production data, and there is no automatic local-to-production or
production-to-local synchronization.

The development URL is printed by Astro. One development server at a time is
supported; automatic port allocation for concurrent instances is not
currently provided.

Before opening a pull request, run:

```console
yarn check
```

The application is written in strict TypeScript and uses Astro with the official Cloudflare adapter, React islands, Vite, and Vitest.
The package supports Node.js `>=22.12.0`; development and CI use Node.js 24 without pinning a patch release.
Deployed Workers run on Cloudflare's `workerd` runtime rather than Node.js.

[Back to 📚TOC](#-table-of-contents)

## 🛡️ License
microfeed is licensed under the [AGPL-3.0](https://github.com/microfeed/microfeed/blob/main/LICENSE) license. Please see [the LICENSE file](https://github.com/microfeed/microfeed/blob/main/LICENSE) for more information.

[Back to 📚TOC](#-table-of-contents)
