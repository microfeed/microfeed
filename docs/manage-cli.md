# `yarn manage` command reference

This is the canonical capability reference for microfeed's repository-owned
management CLI. It is written for people and coding agents that need to
understand what the CLI can do, what it changes, and which safeguards apply.

Use the README for approachable installation workflows. Use this document when
you need the complete command and option contract. Run `yarn manage help
<command>` for the corresponding terminal reference.

## Contents

- [Before running commands](#before-running-commands)
- [Safety model](#safety-model)
- [Command summary](#command-summary)
- [Shared conventions](#shared-conventions)
- [Command reference](#command-reference)
  - [`accounts`](#yarn-manage-accounts)
  - [`init`](#yarn-manage-init)
  - [`connect`](#yarn-manage-connect)
  - [`deploy`](#yarn-manage-deploy)
  - [`dev`](#yarn-manage-dev)
  - [`snapshot`](#yarn-manage-snapshot)
  - [`status`](#yarn-manage-status)
  - [`destroy`](#yarn-manage-destroy)
  - [`migrate-pages`](#yarn-manage-migrate-pages)
  - [`domain`](#yarn-manage-domain)
  - [`access`](#yarn-manage-access)
  - [`auth`](#yarn-manage-auth)
  - [`config`](#yarn-manage-config)
  - [`instances`](#yarn-manage-instances)
  - [`use`](#yarn-manage-use)
- [Built-in help](#built-in-help)
- [Environment variables](#environment-variables)
- [Maintaining this reference](#maintaining-this-reference)

## Before running commands

Run `yarn manage` from a local clone of microfeed. The command is part of this
repository and is not installed globally.

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install --immutable
yarn manage help
```

Cloudflare operations use Wrangler browser authorization. Credentials are
managed by Wrangler; do not paste Cloudflare tokens into command arguments or
agent conversations.

Cloudflare repository imports, Workers Builds, deploy buttons, GitHub Actions,
and API-token deployment are not supported. Both people and local coding agents
use this `yarn manage` interface.

## Safety model

- `yarn manage` is the only supported CLI interface for microfeed Cloudflare
  mutations. Do not replace it with improvised Wrangler or REST commands.
- Initialization validates the selected account and checks Worker, Pages, D1,
  and, unless `--no-r2` is used, R2 name collisions before creating resources.
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
- Local development uses isolated D1 and optional R2 simulations. It does not
  copy or synchronize production data.
- Snapshot restore validates every checksum and historical migration hash
  before mutation. Remote restore requires an unchanged, newly initialized
  target and exact instance-name confirmation, and leaves a resumable
  maintenance journal if migration or data restoration fails.

## Command summary

| Command | Purpose | External effect |
| --- | --- | --- |
| `accounts` | Authorize and list Cloudflare accounts | Read-only discovery; may update local OAuth profiles and the repository binding |
| `init` | Initialize production, preview, or local installation | Creates or updates Cloudflare resources, or local-only state |
| `connect` | Save an existing compatible Worker in this clone | Reads Cloudflare; writes local state only |
| `deploy` | Check, migrate, deploy, verify, or prepare a local release | Updates Worker code and D1 migrations, or only local state with `--local` |
| `dev` | Run a selected site locally | Starts a local server and changes local simulation data |
| `snapshot` | Create, pull, or restore a portable backup | Read-only export, local state creation, or an exactly confirmed fresh remote replacement |
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
an instance. Use `yarn manage instances` to review choices and `yarn manage use
<name>` to change the default.

### Selecting a Cloudflare account

Use `yarn manage accounts` first. Commands that operate on a saved deployment
automatically require its recorded account. Supplying `--account-id <id>` is an
additional exact-account assertion; it cannot override saved ownership.

To keep separate Cloudflare logins on the same computer, use
`yarn manage accounts --profile <name>`. The named Wrangler profile is local to
your computer and does not need to be globally unique. It is separate from the
microfeed site/Worker name, which should be globally distinctive.

### Production, preview, and local data

- No environment flag means the production Cloudflare installation.
- `--preview` selects the isolated preview Worker and D1 database. Preview is
  available only after production R2 is ready and shares that bucket as a
  preserved resource.
- `--local` is supported only where documented. Local state is stored under
  the selected instance and never accesses production D1 or R2 data.

### Interactive and non-interactive operation

`--yes` skips only prompts supported by a command. It does not bypass account,
identity, collision, reuse, password, or deletion safeguards. `destroy`
deliberately rejects it.

When R2 becomes available for an automatic pending installation, interactive
`deploy` asks whether to add it and defaults to yes. A decline records the
durable disabled choice. A non-interactive terminal continues content-only,
keeps the automatic state, and prints the exact `deploy --enable-r2` command.

## Command reference

## `yarn manage accounts`

**Purpose:** Authorize Cloudflare and list available accounts.

**Changes:** Read-only Cloudflare discovery; may update local OAuth profiles
and the repository binding.

Authorize Cloudflare and list every account available to the active Wrangler
login. This command never creates or changes a Worker, D1 database, R2 bucket,
domain, or microfeed configuration.

A Wrangler profile is a Cloudflare login saved on the local computer. A
Cloudflare account is a workspace that owns sites, databases, media storage,
and other Cloudflare resources. One login profile may have access to one or
more Cloudflare accounts.

The output lists every locally stored profile, marks the one active for this
local repository, and prints an exact `yarn manage accounts --profile <name>`
command for each other named profile. The displayed email and Cloudflare
accounts belong only to the active profile; inactive profiles remain stored
but are not queried. Wrangler's `default` profile is a fallback login rather
than a named profile selected by this option.

Use `--profile <name>` to create or select a named Wrangler OAuth login and
bind it to this local Git copy of the repository. If the profile does not yet
exist, the command opens Cloudflare authorization to create it. If it already
exists, the command selects it without changing its credentials. Add
`--reauthorize` to replace that named profile's authorization deliberately.
Wrangler profile names accept ASCII letters, numbers, hyphens, and underscores;
`default` and `staging` are reserved. Wrangler currently labels named profiles
as a beta feature.

```console
yarn manage accounts [--json] [--profile <name>] [--reauthorize]
```

| Option | Meaning |
| --- | --- |
| `--json` | Print the login, active profile, all profiles with active markers, and `{name, id}` accounts as JSON. |
| `--profile <name>` | Create or select a named Wrangler OAuth login and bind it to this local repository. |
| `--reauthorize` | Force fresh browser authorization, for example when the desired account is missing. |

OAuth rejection, missing permissions, zero accounts, or an unavailable browser
callback fail before resource creation.

## `yarn manage init`

**Purpose:** Initialize or resume a production, preview, or local installation.

**Changes:** Creates or updates Cloudflare resources, or creates an isolated
local sandbox with `--local`.

Initialize or resume an installation. Production initialization can create a
Worker, D1 database, optional R2 bucket, secrets, migrations, administrator password
setup link, and
optional custom domain. It performs collision checks before the first mutation.
The authentication choice and any public-dashboard warning are confirmed before
D1 or R2 resources are created. If initialization is interrupted later, retrying
preserves whether each recorded resource was created for this site or explicitly
reused. The fresh-target snapshot fingerprint is recorded after initialization,
including optional custom-domain and login setup, has finished.

```console
yarn manage init [--instance <name>] [--preview|--local] [options]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site name. |
| `--account-id <id>` | Use one exact Cloudflare account. |
| `--project-name <name>` | Set the production or preview Worker name: 1–63 ASCII letters, numbers, or hyphens; no leading or trailing hyphen. |
| `--d1-name <name>` | Set the production or preview D1 name. |
| `--r2-name <name>` | Set the production R2 name; preview always shares production media. |
| `--admin-path <path>` | Set the remote dashboard path, defaulting to `admin`. |
| `--admin-auth <built-in\|none>` | Enable built-in protection or deliberately skip it. |
| `--owner-email <email>` | Set the administrator sign-in email. |
| `--admin-password <value>` | Unsafe remote-only automation password. Never use from an agent. |
| `--no-open` | Print the private password page without opening a browser. |
| `--reuse-d1` | Explicitly reuse a same-named existing D1 database. |
| `--reuse-r2` | Explicitly reuse a same-named existing production R2 bucket. |
| `--no-r2` | Skip every R2 discovery and creation step, omit `MEDIA_BUCKET`, and save the validated future bucket name. Cannot be combined with `--reuse-r2` or `--preview`. |
| `--preview` | Create or resume preview after production exists. |
| `--local` | Create or resume a local-only site. Cannot be combined with `--preview`. |
| `--yes` | Accept supported non-secret remote defaults. It never approves collisions implicitly. |

Examples:

```console
yarn manage init
yarn manage init --preview
yarn manage init --local
yarn manage init --no-r2 --r2-name future-media
```

`--no-r2` works for both Cloudflare and local-only initialization. It creates a
content-only instance where D1 publishing and external URLs continue to work.
It never detaches an already configured bucket. Enable the saved bucket later
with `yarn manage deploy --enable-r2`.

Without `--no-r2`, only Cloudflare's documented R2 subscription-required
response (`10042`, `NotEntitled`) is safely deferrable. The Worker is deployed
and verified without `MEDIA_BUCKET`, the saved setup mode remains automatic,
and the CLI prints the exact account's R2 dashboard link. R2 activation and any
payment-method or billing consent stay in Cloudflare's dashboard; microfeed
never performs those actions. Permission, authentication, and unknown R2
failures remain fatal.

Choose a globally unique, distinctive site name. If you plan to use a custom
address, replace its dots with hyphens; for `my.domainname.com`, use
`my-domainname-com`. Fresh interactive Cloudflare initialization does not
preselect a generic site name.

Rerun the identical command after interruption. Saved progress prevents
duplicate creation and unrelated-resource overwrite.

On a newly created Cloudflare account, its first Worker deployment may report
that `workers.dev` is not ready while Cloudflare finishes preparing the
account. Wait a few minutes, then rerun the same `yarn manage init` command.
The saved initialization resumes without duplicating completed work.

microfeed enables the free `workers.dev` address, so Worker names are checked
against its Cloudflare naming rules: 1–63 ASCII letters, numbers, or hyphens,
with no leading or trailing hyphen. A one-character Worker name is valid.
Names only need to be unused in the selected Cloudflare account; before its
first change, the CLI checks that account for an existing Worker or Pages
project with the same name. Explicit invalid names are rejected before
Cloudflare authorization. D1 database and R2 bucket names are validated
separately before resource creation.

If a same-named Worker exists but this clone has no saved state for it, `init`
stops without overwriting it. Use the exact `yarn manage connect --worker
<name> --instance <name>` command printed by the error when that Worker is an
existing microfeed installation. Otherwise, choose a different project name.

If resource provisioning or the first-password handoff is incomplete, `init`
resumes only the unfinished work and preserves every recorded resource. When
the installation and dashboard login are already ready, it stops without
changing anything and points to `deploy`, `status`, `domain`, and `auth` for
later management.

## `yarn manage connect`

**Purpose:** Connect an existing Cloudflare microfeed to this clone.

**Changes:** Reads Cloudflare and writes local connection state; does not change
Cloudflare.

Discover an existing compatible microfeed Worker, including a content-only
Worker identified by its D1 binding and saved R2 variables, verify its public
identity, and save it in this clone. Cloudflare is not changed. Connected D1
and any ready R2 resource are marked reused and preserved by later destruction.

```console
yarn manage connect [--account-id <id>] [--worker <name>] [--instance <name>]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Search one exact account. |
| `--worker <name>` | Select an exact compatible Worker. |
| `--instance <name>` | Choose the local saved name. |
| `--yes` | Run without selection prompts; requires `--worker` when several matches exist. |

## `yarn manage deploy`

**Purpose:** Check, migrate, deploy, and verify a saved installation.

**Changes:** Updates a selected Cloudflare Worker, or prepares a local-only
release with `--local`.

Regenerate configuration, apply D1 migrations, run checks and tests, and build.
Cloudflare mode then tags the Worker version with the current Git commit,
deploys it, and verifies the Worker. The protected dashboard uses that version
metadata to identify the deployed source release. `--local` preserves local
data, performs the same preparation against local D1, and does not deploy or
start a server.

```console
yarn manage deploy [--instance <name>] [--preview|--local] [--enable-r2]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Deploy preview instead of production. |
| `--local` | Prepare an instance created with `init --local`; cannot target a Cloudflare-managed instance or be combined with `--preview`. |
| `--enable-r2` | Require R2 entitlement and permanently prepare/bind the saved bucket, or add the simulated binding with `--local`. Idempotent when already ready. |
| `--reuse-r2` | Explicitly approve reuse if the saved bucket name already exists during Cloudflare enablement. `--enable-r2` alone never approves reuse. |
| `--yes` | Run without optional prompts. Pending R2 remains automatic and content-only unless `--enable-r2` is supplied. |

`deploy` only operates on instances with configuration saved in this clone. If
the microfeed already exists on Cloudflare, run `yarn manage connect --instance
<name>` first and select its Worker. If it does not exist yet, run `yarn manage
init --instance <name>` instead.

An ordinary deployment does not probe or prompt when media storage is already
ready or explicitly disabled. For automatic pending setup, `NotEntitled`
continues content-only with an activation reminder. When R2 is available, an
interactive deployment offers to add it; declining records disabled so future
deployments stay quiet. Non-interactive deployment prints the deterministic
enable command and leaves the automatic pending state unchanged.

Explicit enablement fails with the account-specific dashboard and billing
instructions if R2 is still unavailable. After successful creation or approved
reuse, the generated Worker configuration contains the exact `MEDIA_BUCKET`
binding, and deployment verifies both the bucket and Worker binding before
completing. A later failure remains resumable. The CLI records a fresh remote
restore baseline only when D1 is still bootstrap-only and the new bucket is
empty; failing that eligibility check does not undo working R2 setup.

## `yarn manage dev`

**Purpose:** Run one site locally with isolated development data.

**Changes:** Starts a local server and changes only isolated local D1/R2
simulation data.

Run the selected site locally after applying local migrations. Even when the
site is connected to Cloudflare, development uses isolated local D1 and R2
simulations.

```console
yarn manage dev [--instance <name>] [--preview]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the local sandbox. |
| `--preview` | Use preview configuration with isolated local data. |

## `yarn manage snapshot`

**Purpose:** Create, download, validate, and restore migration-safe portable snapshots.

**Changes:** Creates a read-only export, restores a new local instance, or
replaces the data in one explicitly confirmed fresh Cloudflare target.

The archive is one `.tar.gz` containing `manifest.json`, separate D1 schema and
durable-data SQL exports, and every object in the production R2 bucket. The
manifest records SHA-256 checksums, object metadata, table classifications, row
counts, and the exact ordered D1 migration filenames and hashes.

Long-running snapshot creation and restore steps keep an animated elapsed-time
indicator visible. Its brief status message changes as D1, migrations, R2, and
verification work advances, then ends with a green success or red failure mark.

```console
yarn manage snapshot <create|pull|restore> [options]
```

| Option | Meaning |
| --- | --- |
| `create\|pull\|restore` | Select the snapshot action. |
| `--instance <name>` | Select the source or restore target instance. |
| `--output <file>` | Choose a new `.tar.gz` output path for `create` or `pull`; existing files are never overwritten. |
| `--local-instance <name>` | Choose the new local instance created by `pull`. |
| `--file <file>` | Read this portable archive for `restore`. |
| `--local` | Restore into a new local-only instance. |
| `--dry-run` | Validate and print a remote restore plan without changing the target. |
| `--confirm <name>` | Approve remote replacement by exactly matching the fresh target instance. |

### Common examples

#### 1. Back up a production instance into one `.tar.gz` file

```console
yarn manage snapshot create \
  --instance my-podcast-domain-com \
  --output my-podcast-domain-com-backup.tar.gz
```

#### 2. Create a local instance directly from a production instance

```console
# No separate .tar.gz download is required first. This command creates a
# temporary snapshot, restores it into the new local instance, then removes it.
yarn manage snapshot pull \
  --instance my-podcast-domain-com \
  --local-instance my-podcast-production-copy
```

Add `--output my-podcast-domain-com-backup.tar.gz` if you also want to keep the
downloaded snapshot.

#### 3. Create a local instance from a `.tar.gz` file

```console
# The local instance name must be new.
yarn manage snapshot restore \
  --file my-podcast-domain-com-backup.tar.gz \
  --local \
  --instance my-podcast-archive-copy
```

If the snapshot has no administrator account, the completed restore prints the
exact next step for creating the local dashboard login:

```console
yarn manage auth setup \
  --instance my-podcast-archive-copy
```

#### 4. Create a remote instance from a `.tar.gz` file

```console
# First initialize a fresh remote target with new, nonreused D1 and R2 resources.
yarn manage init --instance restored-podcast-domain-com

# Validate the archive and target without changing Cloudflare data.
yarn manage snapshot restore \
  --file my-podcast-domain-com-backup.tar.gz \
  --instance restored-podcast-domain-com \
  --dry-run

# Then restore by confirming the exact target instance name.
yarn manage snapshot restore \
  --file my-podcast-domain-com-backup.tar.gz \
  --instance restored-podcast-domain-com \
  --confirm restored-podcast-domain-com
```

#### 5. Create one remote instance from another remote instance

```console
# A local .tar.gz handoff is currently required. Download the source first.
yarn manage snapshot create \
  --instance my-podcast-domain-com \
  --output my-podcast-domain-com-backup.tar.gz

# Initialize a fresh target with new, nonreused D1 and R2 resources.
yarn manage init --instance new-podcast-domain-com

# Validate the archive and target, then perform the confirmed restore.
yarn manage snapshot restore \
  --file my-podcast-domain-com-backup.tar.gz \
  --instance new-podcast-domain-com \
  --dry-run

yarn manage snapshot restore \
  --file my-podcast-domain-com-backup.tar.gz \
  --instance new-podcast-domain-com \
  --confirm new-podcast-domain-com
```

### Migration safety

Snapshot creation refuses a D1 migration ledger that is not an ordered prefix
of this checkout's `migrations/` directory. It also refuses any application
table absent from the explicit durable, ephemeral, target-specific, or internal
classification. Released migration files and historical classifications are
therefore immutable.

Restore validates the complete archive before changing a target. Its migration
list must be an exact filename-and-hash prefix of the current checkout:

- An older snapshot restores its original schema and durable data, recreates
  its `d1_migrations` ledger, and then applies only newer migrations.
- A snapshot at the current head needs no forward migrations.
- A newer, missing, reordered, edited, or divergent migration history is
  rejected before mutation.

Durable tables currently include channels, items, settings, users, and login
accounts. Sessions, verification records, rate-limit state, and password
setup/reset records are recreated empty. The target installation identity is
rewritten, while the administrator email and password hash are preserved.
`publicBucketUrl` is reset to `/media/`.

### Restore safety and recovery

Local restore requires a name that has never been initialized. It builds D1 and
R2 state in a temporary persistence directory, verifies it, and only then makes
that state active.

Remote restore supports production targets only. First initialize a new target
whose D1 and R2 resources are not reused. Initialization records a fingerprint
of the fresh database and empty bucket. Always run `--dry-run`; mutation rejects
`--yes` and requires the exact `--confirm <name>` value.

Archive validation and target readiness are separate dry-run stages. A message
that the snapshot archive is valid confirms only the file and its migration
history; it does not approve the restore target. If a completed initialization
is missing its fingerprint, an interactive `--dry-run` offers to repair the
local safety record only after read-only checks prove all of the following:

- The deployed Worker exposes this saved installation identity.
- The exact saved D1 database exists, has the current schema and migration
  ledger, and contains no content beyond the exact channel and settings rows
  that microfeed automatically creates on the first page request.
- With built-in login, D1 may contain the exact one-time initial password setup
  record created during initialization. Restore clears that record. Password
  reset links and all other authentication activity are rejected.
- The installation row belongs to this instance and the R2 bucket is empty.

The same strict checks run automatically if the saved fingerprint changes. This
can happen when the fresh Worker creates its exact automatic channel and
settings defaults on the first page request. If those defaults are the only
change, restore refreshes the local fingerprint and continues. The pending
initial password link described above is also safe because restore clears all
one-time authentication state. Any user-created content or identity, schema,
migration, index, or R2 difference is rejected.

A successful repair or refresh saves the fingerprint in the local instance
configuration; the later restore refuses to start if the target changes again.
It changes no Cloudflare data or D1/R2 ownership flags, and resources already
marked reused remain protected from `yarn manage destroy`. The dry run never
imports the snapshot. An incomplete initialization still must be finished
before restore, while a nonempty or mismatched target is rejected.

After an interrupted restore has finished uploading media, rerunning
`--dry-run` also compares the current R2 inventory with the archive and reports
the exact missing or extra object, byte-size difference, or metadata difference.
This diagnostic is read-only and avoids repeating the upload just to identify
the previous verification failure.

After confirmation, the Worker enters maintenance mode. The CLI reimports the
archived schema/data and ledger in one D1 import, applies forward migrations,
replaces R2 content using streaming multipart uploads, verifies migrations,
tables, indexes, foreign keys, administrator data, row counts, installation
identity, and R2 keys/sizes, and only then deploys the current Worker. If R2's
inventory does not immediately reflect completed multipart uploads, verification
keeps its spinner active and retries for up to one minute before reporting exact
differences. A failure keeps maintenance mode and an owner-only resume journal.
Rerunning the same archive and confirmation starts again from the archived
schema and data before retrying migrations.

While maintenance mode is active, the CLI temporarily enables the Worker's
otherwise-disabled `workers.dev` address as a token-protected control endpoint.
Every request without the one-time restore token receives HTTP 503, and the
normal deployment disables that address again after a successful restore. This
keeps restore control independent of custom-domain DNS and Access settings.

If the snapshot contains no administrator account, successful local and remote
restore completion prints the exact `yarn manage auth setup --instance <name>`
command. Running it asks for the administrator email when needed and creates a
private one-time browser link for choosing the first password.

Snapshots include password hashes and possibly private media. They are
unencrypted and created with owner-only (`0600`) permissions. Store and encrypt
them according to your backup policy.

Cloudflare snapshot create, pull, and remote restore require a ready production
R2 bucket and binding. Run `yarn manage deploy --enable-r2` first for a
content-only installation. Preview initialization is blocked by the same
production-R2 requirement.

## `yarn manage status`

**Purpose:** Verify Cloudflare resources, the public site, and dashboard protection.

**Changes:** Read-only Cloudflare and public-site verification.

Read and verify the exact Worker and D1 binding, public URL, administrator
state, pending password setup, and anonymous dashboard protection. When R2 is
ready, also verify both the exact bucket and the Worker's `MEDIA_BUCKET`
binding. A verified content-only Worker is healthy and reports media as either
subscription-pending or user-disabled.

```console
yarn manage status [--instance <name>] [--preview]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Check preview instead of production. |

This command is read-only. Missing resources or unsafe protection produce a
non-zero result with recovery guidance.

## `yarn manage destroy`

**Purpose:** Inspect and safely remove a saved Cloudflare deployment.

**Changes:** Permanently deletes owned Cloudflare resources and local instance
data unless explicitly preserved.

Inventory and safely remove one saved Cloudflare deployment. Always begin with
`--dry-run`; it prints the exact site, account, Worker, D1 ID/name, R2 bucket,
custom address, local folder, actions, and inspection links.

```console
yarn manage destroy --instance <name> --dry-run
yarn manage destroy --instance <name> --confirm <name>
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

## `yarn manage migrate-pages`

**Purpose:** Create a side-by-side Worker migration from Cloudflare Pages.

**Changes:** Creates a side-by-side Worker and local state; reuses but does not
modify or delete the Pages project, D1, or R2.

Create a differently named Worker beside an existing Pages installation while
reusing the existing D1 database and R2 bucket. The command does not modify or
delete Pages; traffic cutover remains manual.

```console
yarn manage migrate-pages [--pages-name <name>] [--project-name <name>] [options]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Use one exact account. |
| `--instance <name>` | Choose the new local saved name. |
| `--pages-name <name>` | Select the existing Pages project. |
| `--project-name <name>` | Set a new Worker name different from Pages, using the same Worker naming rules as `init`. |
| `--d1-name <name>` | Select the existing Pages D1 database. |
| `--r2-name <name>` | Select the existing Pages R2 bucket. |
| `--admin-path <path>` | Set the new Worker dashboard path. |
| `--admin-auth <built-in\|none>` | Choose dashboard authentication. |
| `--owner-email <email>` | Set the new Worker administrator email. |
| `--no-open` | Do not open the private password page automatically. |
| `--yes` | Approve the displayed reuse and supported defaults. |

`--preview` is rejected because the new migration Worker is already deployed
side by side.

## `yarn manage domain`

**Purpose:** Configure and verify a production custom domain.

**Changes:** Deploys the production Worker with a Cloudflare Custom Domain and
updates local state.

Configure and verify a Worker Custom Domain for production. Preview always uses
its workers.dev URL. If the hostname remains attached to a recorded Pages
project, the command stops and links to the manual Pages detachment screen.

```console
yarn manage domain [--instance <name>] [--hostname <hostname>]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the production site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--hostname <hostname>` | Set the custom hostname without a path. |
| `--yes` | Skip supported post-deployment prompts. |

A pending browser password link is replaced with one using the final hostname.

## `yarn manage access`

**Purpose:** Guide and verify optional Cloudflare Access protection.

**Changes:** Opens Cloudflare for a user-managed Access application; the CLI
itself only guides and verifies.

Print exact guidance for an optional Cloudflare Access application that covers
only the dashboard path. The user saves the Access application in Cloudflare; the
CLI can then verify that the dashboard is intercepted while public routes stay
available.

```console
yarn manage access [--instance <name>] [--preview] [--open]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Target preview instead of production. |
| `--open` | Open the Cloudflare Access application page immediately. |
| `--yes` | Print instructions without interactive opening or verification prompts. |

## `yarn manage auth`

**Purpose:** Set up or change the built-in dashboard login and path.

**Changes:** Updates administrator credentials, configuration, D1 rows, and
sometimes redeploys the Worker. Local-only disable changes only saved
configuration and its generated Wrangler file.

Manage the built-in administrator login and path.

```console
yarn manage auth <setup|reset-password|change-email|change-path|disable> [options]
```

| Action | Effect |
| --- | --- |
| `setup` | Remotely, enable the built-in login and create a first-password browser link when needed; locally, securely prompt for the initial password. |
| `reset-password` | Remotely, create a single-use reset link; locally, securely prompt for and immediately store the replacement password. |
| `change-email` | Update the administrator email and revoke existing sessions. |
| `change-path` | Redeploy at a new dashboard path; the old path returns 404. |
| `disable` | Disable built-in protection after a high-visibility warning. Locally, the development dashboard opens without login; remotely, the dashboard may become public. |

Without an action, `yarn manage auth` prints its subcommand usage, options, and
examples. It does not select an instance, inspect authentication state, or
change anything. Choose `setup`, `reset-password`, `change-email`,
`change-path`, or `disable` explicitly.

After an action is selected, the CLI shows a **Dashboard login target** summary
before prompting or changing anything. It identifies the instance, whether the
command targets local data, Cloudflare production, or Cloudflare preview, the
dashboard location, and the selected action. Cloudflare targets also show the
Worker name. Check this summary before entering an email or password.

A saved local-only instance is detected automatically after an action is
selected. It supports `setup`, `change-email`, `reset-password`, and `disable`.
Local disable keeps the existing account, credentials, D1 data, and R2 data,
then regenerates the instance configuration; restart its development server if
it is running. Changing the dashboard path remains remote-only. A
Cloudflare-connected site's local sandbox cannot override the saved production
authentication mode. Remote `setup` does not redeploy when built-in login is
already active.

Target selection follows the saved instance type:

- A local-only instance automatically uses its local data; `--local` is not
  required.
- A Cloudflare-connected instance targets Cloudflare by default. Add `--local`
  only to target its separate local development sandbox.
- `--preview` targets a Cloudflare preview and cannot be combined with a local
  target.

Snapshot restore still requires `--local` because it creates a brand-new local
instance whose type cannot be inferred yet.

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--account-id <id>` | Confirm the exact saved account. |
| `--preview` | Target the preview login. |
| `--local` | Use a Cloudflare-connected instance's separate local development sandbox; optional for local-only instances. |
| `--owner-email <email>` | Supply the email for `setup` or `change-email`. |
| `--admin-path <path>` | Set the new path for `change-path`. |
| `--admin-password <value>` | Unsafe remote-only value for `setup` or `reset-password`. Never use from an agent. |
| `--no-open` | Print a setup/reset link without opening it. |
| `--yes` | Skip supported confirmations, including the `disable` warning. |

Local examples:

```console
yarn manage auth change-email \
  --instance microfeed-org-local \
  --owner-email new-owner@example.com

yarn manage auth reset-password \
  --instance microfeed-org-local

yarn manage auth disable \
  --instance microfeed-org-local
```

Local password reset always uses hidden password and confirmation prompts.
Local disable shows a warning unless `--yes` is supplied and does not query or
modify the simulated D1 or R2 data.

## `yarn manage config`

**Purpose:** Validate saved state and generate a local Wrangler configuration.

**Changes:** Writes only the generated local Wrangler configuration when
needed.

Validate saved state and regenerate the selected local Wrangler configuration
without deployment or a development server. With `--local`, missing local-only
state and development secrets may be initialized.

```console
yarn manage config [--instance <name>] [--preview|--local]
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Select the saved site. |
| `--preview` | Generate preview configuration. |
| `--local` | Generate the local view and ensure local development values exist. |

## `yarn manage instances`

**Purpose:** List local, managed, and connectable microfeed installations.

**Changes:** Reads local saved state and available Cloudflare Workers; does not
change Cloudflare.

List local-only sites, Cloudflare sites managed by this clone, and compatible
Cloudflare Workers available to connect. Output is grouped by account and
includes each media-storage state and ready-to-run `connect` commands. No
Cloudflare resources are changed.

```console
yarn manage instances [--account-id <id>]
```

| Option | Meaning |
| --- | --- |
| `--account-id <id>` | Limit Cloudflare discovery to one available account. |

## `yarn manage use`

**Purpose:** Select the default saved site.

**Changes:** Changes only the active-instance pointer in local repository state.

Set the active saved site used when later commands omit `--instance`. This
changes only local repository state.

```console
yarn manage use <name>
```

| Option | Meaning |
| --- | --- |
| `--instance <name>` | Alternate flag form of the positional site name. |

## Built-in help

```console
yarn manage
yarn manage help
yarn manage help destroy
yarn manage destroy --help
```

Top-level help lists every command. Command help is generated from the same
metadata inventory used by documentation consistency tests.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MICROFEED_INSTANCE` | Default site name when `--instance` is omitted. |
| `CLOUDFLARE_PROJECT_NAME` | Default production Worker name during initialization. |

Wrangler manages Cloudflare account and OAuth environment internally. Do not
use environment variables to pass a microfeed password.

## Maintaining this reference

The command inventory and terminal help live in `manage-cli/help.ts`. This file
is the checked-in human-and-agent interface contract. Tests require every
implemented command and every metadata option to appear here, so additions
cannot silently disappear from either discovery surface.

When changing the CLI:

1. Update command behavior.
2. Update `manage-cli/help.ts`.
3. Update the matching section in this document.
4. Run the management CLI help/documentation consistency tests and the normal
   repository checks.
