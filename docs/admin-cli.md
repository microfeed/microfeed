# `yarn admin` command reference

This is the canonical capability reference for microfeed's repository-owned
administration command. It is written for people and coding agents that need to
understand what the CLI can do, what it changes, and which safeguards apply.

Use the README for approachable installation workflows. Use this document when
you need the complete command and option contract. Run `yarn admin help
<command>` for the corresponding terminal reference.

## Contents

- [Before running commands](#before-running-commands)
- [Safety model](#safety-model)
- [Command summary](#command-summary)
- [Shared conventions](#shared-conventions)
- [Command reference](#command-reference)
  - [`accounts`](#yarn-admin-accounts)
  - [`setup`](#yarn-admin-setup)
  - [`connect`](#yarn-admin-connect)
  - [`deploy`](#yarn-admin-deploy)
  - [`dev`](#yarn-admin-dev)
  - [`status`](#yarn-admin-status)
  - [`destroy`](#yarn-admin-destroy)
  - [`migrate-pages`](#yarn-admin-migrate-pages)
  - [`domain`](#yarn-admin-domain)
  - [`access`](#yarn-admin-access)
  - [`auth`](#yarn-admin-auth)
  - [`config`](#yarn-admin-config)
  - [`instances`](#yarn-admin-instances)
  - [`use`](#yarn-admin-use)
- [Built-in help](#built-in-help)
- [Environment variables](#environment-variables)
- [Maintaining this reference](#maintaining-this-reference)

## Before running commands

Run `yarn admin` from a local clone of microfeed. The command is part of this
repository and is not installed globally.

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install --immutable
yarn admin help
```

Cloudflare operations use Wrangler browser authorization. Credentials are
managed by Wrangler; do not paste Cloudflare tokens into command arguments or
agent conversations.

## Safety model

- `yarn admin` is the only supported CLI interface for microfeed Cloudflare
  mutations. Do not replace it with improvised Wrangler or REST commands.
- Setup validates the selected account and checks Worker, Pages, D1, and R2
  name collisions before creating resources.
- Existing D1 or R2 resources require explicit reuse approval. Resources
  recorded as reused are never deleted by `destroy`.
- Saved Cloudflare deployments retain their exact account ID. Later commands
  stop if the current login cannot access that account.
- Built-in login passwords should be created through the private browser link.
  `--admin-password` is an intentionally unsafe automation escape hatch because
  process arguments may appear in shell history, process lists, transcripts,
  and logs.
- `destroy` requires a read-only plan and an exact site-name confirmation. It
  rejects `--yes`, verifies resource identity, and records progress so the same
  command can resume safely.
- Local development uses isolated D1 and R2 simulations. It does not copy or
  synchronize production data.

## Command summary

| Command | Purpose | External effect |
| --- | --- | --- |
| `accounts` | Authorize and list Cloudflare accounts | Read-only discovery; may update local OAuth credentials |
| `setup` | Create production, preview, or local installation | Creates or updates Cloudflare resources, or local-only state |
| `connect` | Save an existing compatible Worker in this clone | Reads Cloudflare; writes local state only |
| `deploy` | Check, migrate, deploy, and verify | Updates Worker code and D1 migrations |
| `dev` | Run a selected site locally | Starts a local server and changes local simulation data |
| `status` | Verify resources and protection | Read-only Cloudflare and HTTP checks |
| `destroy` | Inspect and remove a deployment | Permanent deletion unless data is preserved |
| `migrate-pages` | Deploy a side-by-side Worker for Pages migration | Creates a Worker; preserves the Pages project and reused data |
| `domain` | Configure a production custom domain | Updates and redeploys the Worker route |
| `access` | Guide optional Cloudflare Access protection | User performs the dashboard change; CLI guides and verifies |
| `auth` | Manage built-in login, email, password, and path | Updates D1/configuration and may redeploy |
| `config` | Validate state and regenerate Wrangler configuration | Local files only |
| `instances` | List saved and discoverable installations | Read-only local and Cloudflare discovery |
| `use` | Select the default saved site | Local active-instance pointer only |

## Shared conventions

### Selecting a site

Use `--instance <name>` whenever the target is not already the active saved
site. `MICROFEED_INSTANCE` supplies the same selection for commands that accept
an instance. Use `yarn admin instances` to review choices and `yarn admin use
<name>` to change the default.

### Selecting a Cloudflare account

Use `yarn admin accounts` first. Commands that operate on a saved deployment
automatically require its recorded account. Supplying `--account-id <id>` is an
additional exact-account assertion; it cannot override saved ownership.

### Production, preview, and local data

- No environment flag means the production Cloudflare installation.
- `--preview` selects the isolated preview Worker and D1 database. Preview
  shares the production R2 bucket as a preserved resource.
- `--local` is supported only where documented. Local state is stored under
  the selected instance and never accesses production D1 or R2 data.

### Interactive and non-interactive operation

`--yes` skips only prompts supported by a command. It does not bypass account,
identity, collision, reuse, password, or deletion safeguards. `destroy`
deliberately rejects it.

## Command reference

## `yarn admin accounts`

**Purpose:** Authorize Cloudflare and list available accounts.

**Changes:** Read-only Cloudflare discovery; may update local OAuth credentials.

Authorize Cloudflare and list every account available to the active Wrangler
login. This command never creates or changes a Worker, D1 database, R2 bucket,
domain, or microfeed configuration.

```console
yarn admin accounts [--json] [--reauthorize]
```

| Option | Meaning |
| --- | --- |
| `--json` | Print the login, active profile, and `{name, id}` accounts as JSON. |
| `--reauthorize` | Force fresh browser authorization, for example when the desired account is missing. |

OAuth rejection, missing permissions, zero accounts, or an unavailable browser
callback fail before resource creation.

## `yarn admin setup`

**Purpose:** Create or resume a production, preview, or local installation.

**Changes:** Creates or updates Cloudflare resources, or creates an isolated
local sandbox with `--local`.

Create or resume an installation. Production setup can create a Worker, D1
database, R2 bucket, secrets, migrations, administrator setup link, and
optional custom domain. It performs collision checks before the first mutation.

```console
yarn admin setup [--instance <name>] [--preview|--local] [options]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site name. |
| `--account-id <id>` | Use one exact Cloudflare account. |
| `--project-name <name>` | Set the production or preview Worker name. |
| `--d1-name <name>` | Set the production or preview D1 name. |
| `--r2-name <name>` | Set the production R2 name; preview always shares production media. |
| `--admin-path <path>` | Set the remote dashboard path, defaulting to `admin`. |
| `--admin-auth <built-in\|none>` | Enable built-in protection or deliberately skip it. |
| `--owner-email <email>` | Set the administrator sign-in email. |
| `--admin-password <value>` | Unsafe remote-only automation password. Never use from an agent. |
| `--no-open` | Print the private password page without opening a browser. |
| `--reuse-d1` | Explicitly reuse a same-named existing D1 database. |
| `--reuse-r2` | Explicitly reuse a same-named existing production R2 bucket. |
| `--preview` | Create or resume preview after production exists. |
| `--local` | Create or resume a local-only site. Cannot be combined with `--preview`. |
| `--yes` | Accept supported non-secret remote defaults. It never approves collisions implicitly. |

Examples:

```console
yarn admin setup --instance personal
yarn admin setup --preview --instance personal
yarn admin setup --local --instance personal
```

Rerun the identical command after interruption. Saved progress prevents
duplicate creation and unrelated-resource overwrite.

## `yarn admin connect`

**Purpose:** Connect an existing Cloudflare microfeed to this clone.

**Changes:** Reads Cloudflare and writes local connection state; does not change
Cloudflare.

Discover an existing compatible microfeed Worker, verify its public identity,
and save it in this clone. Cloudflare is not changed. The connected D1 and R2
resources are marked reused and therefore preserved by later destruction.

```console
yarn admin connect [--account-id <id>] [--worker <name>] [--instance <name>]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Search one exact account. |
| `--worker <name>` | Select an exact compatible Worker. |
| `--instance <name>` | Choose the local saved name. |
| `--yes` | Run without selection prompts; requires `--worker` when several matches exist. |

## `yarn admin deploy`

**Purpose:** Check, migrate, deploy, and verify a saved installation.

**Changes:** Updates the selected Cloudflare Worker and applies D1 migrations.

Regenerate configuration, apply remote D1 migrations, run checks and tests,
build, deploy the Worker, and verify the public site and admin protection.

```console
yarn admin deploy [--instance <name>] [--preview]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Deploy preview instead of production. |
| `--cloudflare-build` | Reserved internal mode for `WORKERS_CI=1`; rejected in ordinary local use. |

`yarn deploy` is the Cloudflare Workers Builds entry point and invokes the
reserved CI mode.

## `yarn admin dev`

**Purpose:** Run one site locally with isolated development data.

**Changes:** Starts a local server and changes only isolated local D1/R2
simulation data.

Run the selected site locally after applying local migrations. Even when the
site is connected to Cloudflare, development uses isolated local D1 and R2
simulations.

```console
yarn admin dev [--instance <name>] [--preview]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the local sandbox. |
| `--preview` | Use preview configuration with isolated local data. |

## `yarn admin status`

**Purpose:** Verify Cloudflare resources, the public site, and admin protection.

**Changes:** Read-only Cloudflare and public-site verification.

Read and verify the exact Worker, D1 identity, R2 bucket, public URL,
administrator state, pending password setup, and anonymous admin protection.

```console
yarn admin status [--instance <name>] [--preview]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Check preview instead of production. |

This command is read-only. Missing resources or unsafe protection produce a
non-zero result with recovery guidance.

## `yarn admin destroy`

**Purpose:** Inspect and safely remove a saved Cloudflare deployment.

**Changes:** Permanently deletes owned Cloudflare resources and local instance
data unless explicitly preserved.

Inventory and safely remove one saved Cloudflare deployment. Always begin with
`--dry-run`; it prints the exact site, account, Worker, D1 ID/name, R2 bucket,
custom address, local folder, actions, and inspection links.

```console
yarn admin destroy --instance <name> --dry-run
yarn admin destroy --instance <name> --confirm <name>
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the exact saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Target preview; preview must be removed before production. |
| `--dry-run` | Print a read-only plan and dashboard inspection links. |
| `--confirm <name>` | Confirm by exactly matching the saved site name. |
| `--keep-data` | Preserve owned D1 and R2 while removing the Worker and local state. |

`--yes` and `--local` are rejected. Reused data is always preserved. The
command verifies installation identity, refuses unexpected or replacement
resources, deletes the Worker before owned data, records completed steps, and
removes local state last. Rerun the same confirmed command to resume a partial
removal.

## `yarn admin migrate-pages`

**Purpose:** Create a side-by-side Worker migration from Cloudflare Pages.

**Changes:** Creates a side-by-side Worker and local state; reuses but does not
modify or delete the Pages project, D1, or R2.

Create a differently named Worker beside an existing Pages installation while
reusing the existing D1 database and R2 bucket. The command does not modify or
delete Pages; traffic cutover remains manual.

```console
yarn admin migrate-pages [--pages-name <name>] [--project-name <name>] [options]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Use one exact account. |
| `--instance <name>` | Choose the new local saved name. |
| `--pages-name <name>` | Select the existing Pages project. |
| `--project-name <name>` | Set a new Worker name different from Pages. |
| `--d1-name <name>` | Select the existing Pages D1 database. |
| `--r2-name <name>` | Select the existing Pages R2 bucket. |
| `--admin-path <path>` | Set the new Worker dashboard path. |
| `--admin-auth <built-in\|none>` | Choose dashboard authentication. |
| `--owner-email <email>` | Set the new Worker administrator email. |
| `--no-open` | Do not open the private password page automatically. |
| `--yes` | Approve the displayed reuse and supported defaults. |

`--preview` is rejected because the new migration Worker is already deployed
side by side.

## `yarn admin domain`

**Purpose:** Configure and verify a production custom domain.

**Changes:** Deploys the production Worker with a Cloudflare Custom Domain and
updates local state.

Configure and verify a Worker Custom Domain for production. Preview always uses
its workers.dev URL. If the hostname remains attached to a recorded Pages
project, the command stops and links to the manual Pages detachment screen.

```console
yarn admin domain [--instance <name>] [--hostname <hostname>]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the production site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--hostname <hostname>` | Set the custom hostname without a path. |
| `--yes` | Skip supported post-deployment prompts. |

A pending browser password link is replaced with one using the final hostname.

## `yarn admin access`

**Purpose:** Guide and verify optional Cloudflare Access protection.

**Changes:** Opens Cloudflare for a user-managed Access application; the CLI
itself only guides and verifies.

Print exact guidance for an optional Cloudflare Access application that covers
only the admin path. The user saves the Access application in Cloudflare; the
CLI can then verify that the dashboard is intercepted while public routes stay
available.

```console
yarn admin access [--instance <name>] [--preview] [--open]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Target preview instead of production. |
| `--open` | Open the Cloudflare Access application page immediately. |
| `--yes` | Print instructions without interactive opening or verification prompts. |

## `yarn admin auth`

**Purpose:** Set up or change the built-in admin login and path.

**Changes:** Updates admin credentials, configuration, D1 rows, and sometimes
redeploys the Worker.

Manage the built-in administrator login and path.

```console
yarn admin auth [setup|reset-password|change-email|change-path|disable] [options]
```

| Action | Effect |
| --- | --- |
| `setup` | Enable the built-in login and create a first-password browser link when needed. |
| `reset-password` | Create a single-use reset link; existing password remains valid until completion. |
| `change-email` | Update the administrator email and revoke existing sessions. |
| `change-path` | Redeploy at a new admin path; the old path returns 404. |
| `disable` | Disable built-in protection after a high-visibility warning; may make the dashboard public. |

Without an action, the remote command presents a menu. Local authentication
defaults to `setup` and supports no other action.

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Target the preview login. |
| `--local` | Set up a local built-in login. |
| `--owner-email <email>` | Supply the email for `setup` or `change-email`. |
| `--admin-path <path>` | Set the new path for `change-path`. |
| `--admin-password <value>` | Unsafe remote-only value for `setup` or `reset-password`. Never use from an agent. |
| `--no-open` | Print a setup/reset link without opening it. |
| `--yes` | Skip supported confirmations, including the `disable` warning. |

## `yarn admin config`

**Purpose:** Validate saved state and generate a local Wrangler configuration.

**Changes:** Writes only the generated local Wrangler configuration when
needed.

Validate saved state and regenerate the selected local Wrangler configuration
without deployment or a development server. With `--local`, missing local-only
state and development secrets may be initialized.

```console
yarn admin config [--instance <name>] [--preview|--local]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--preview` | Generate preview configuration. |
| `--local` | Generate the local view and ensure local development values exist. |

## `yarn admin instances`

**Purpose:** List local, managed, and connectable microfeed installations.

**Changes:** Reads local saved state and available Cloudflare Workers; does not
change Cloudflare.

List local-only sites, Cloudflare sites managed by this clone, and compatible
Cloudflare Workers available to connect. Output is grouped by account and
includes ready-to-run `connect` commands. No Cloudflare resources are changed.

```console
yarn admin instances [--account-id <id>]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Limit Cloudflare discovery to one available account. |

## `yarn admin use`

**Purpose:** Select the default saved site.

**Changes:** Changes only the active-instance pointer in local repository state.

Set the active saved site used when later commands omit `--instance`. This
changes only local repository state.

```console
yarn admin use <name>
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Alternate flag form of the positional site name. |

## Built-in help

```console
yarn admin
yarn admin help
yarn admin help destroy
yarn admin destroy --help
```

Top-level help lists every command. Command help is generated from the same
metadata inventory used by documentation consistency tests.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MICROFEED_INSTANCE` | Default site name when `--instance` is omitted. |
| `CLOUDFLARE_PROJECT_NAME` | Default production Worker name during setup. |
| `WORKERS_CI=1` | Enables the reserved Cloudflare Workers Builds deploy path used by `yarn deploy`. |

Wrangler manages Cloudflare account and OAuth environment internally. Do not
use environment variables to pass a microfeed password.

## Maintaining this reference

The command inventory and terminal help live in `admin-cli/help.ts`. This file
is the checked-in human-and-agent interface contract. Tests require every
implemented command and every metadata option to appear here, so additions
cannot silently disappear from either discovery surface.

When changing the CLI:

1. Update command behavior.
2. Update `admin-cli/help.ts`.
3. Update the matching section in this document.
4. Run the admin help/documentation consistency tests and the normal repository
   checks.
