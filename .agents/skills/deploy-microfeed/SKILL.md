---
name: deploy-microfeed
description: Deploy and administer microfeed through the source-code-free @microfeed/cli launcher or the project-owned yarn manage CLI. Use when a user asks a coding agent to operate a local or Cloudflare instance, including accounts, initialization, connection, development, deployment, themes, snapshots, status, destruction, Pages migration, domains, Access, built-in authentication, configuration, or instance selection.
---

# Deploy microfeed

Use the repository-owned `yarn manage` engine as the only interface that
changes Cloudflare. Outside a repository clone, invoke that same engine through
`npx @microfeed/cli manage`. Do not replace the CLI workflow with raw Wrangler
commands, Cloudflare API calls, an MCP server, a plugin, or dashboard-created
Worker, D1, or R2 resources.

Read the relevant command section in the canonical
[`yarn manage` reference](../../../docs/manage-cli.md) before using an unfamiliar
command or option. Treat that document as the complete capability and
side-effect contract; keep this skill focused on agent sequencing and safety.

microfeed supports one deployment engine. A person may run `yarn manage` from
a trusted clone, or a local coding agent may use `npx @microfeed/cli manage` to
copy the exact bundled release into a private cache and forward commands to that
engine. Do not offer Cloudflare repository imports, Workers Builds, deploy
buttons, GitHub Actions, raw Wrangler deploys, or API-token deployment as
alternatives. If a user asks for a dashboard-only or hosted deployment,
explain that it is not supported and guide them to the local launcher or clone
workflow. Never request their Cloudflare email, password, private
password-setup link, or token in chat.

Choose one command prefix for the session:

- When the user or launcher invoked `npx @microfeed/cli manage`, use that exact
  prefix for every management command. Translate every `yarn manage …` example
  below to `npx @microfeed/cli manage …`, and translate `yarn dev …` to
  `npx @microfeed/cli manage dev …`.
- When operating inside a user-managed trusted microfeed clone, use the
  documented `yarn manage` and `yarn dev` commands directly.

## Guardrails

- Use this workflow only from a local interactive coding-agent session whose
  environment can complete Wrangler's localhost browser OAuth callback. Do not
  attempt it from a hosted or headless agent session.
- Never request a password or Cloudflare token in chat. Never use
  `--admin-password`; that deliberately unsafe option exists only for
  unattended automation whose operator accepts shell-history, process-list,
  transcript, and CI-log exposure.
- Relay the one-time password-creation URL printed by `yarn manage` exactly once
  so the user can open it. Treat it as private: never ask the user to paste it
  back, write it to a file, reuse it in another command, or expose it after it
  has served its handoff.
- Stop before deployment when the Wrangler browser OAuth callback is
  unavailable.
- In a user-managed clone, inspect `git status --short` before deploying. If
  the working tree is dirty, identify that the current files will be built and
  obtain explicit approval to deploy them. Do not modify, discard, or stash
  the changes. The published launcher instead verifies the file manifest for
  the exact release bundled with `@microfeed/cli` before every forwarded
  command and recreates only its private source cache when verification fails;
  never edit the launcher cache.
- Treat changes to `package.json`, `yarn.lock`, `.yarn/`, `manage-cli/`,
  `wrangler.jsonc`, `wrangler.template.jsonc`, `astro.config.ts`, or this skill
  as security-sensitive because deployment executes or trusts them. Inspect
  their diffs and any untracked files, name them to the user, and recommend a
  clean trusted checkout. Continue only when the user explicitly trusts those
  exact changes; a generic approval of a dirty tree is insufficient.
- Explain the external changes before starting: fresh initialization can
  create a Worker, D1 database, R2 bucket, Worker secrets, and, only when
  selected, a Worker Custom Domain with Cloudflare-managed DNS and
  certificates.
- Keep never-provisioned webhooks off unless the user explicitly asks to enable
  them for an exact production or preview site. Preserve an existing enabled or
  disabled lifecycle state during ordinary deployment; never change it without
  an explicit request. First opt-in creates a dedicated Queue, producer and
  consumer bindings, an hourly maintenance trigger, and an endpoint-secret
  encryption key, so it requires its own approval and exact
  `--enable-webhooks` command.
- Delete a deployment only through `yarn manage destroy`, after its dry run and
  explicit approval of the exact resource list. Never delete reused data,
  bypass identity or replacement-resource checks, pass `--yes`, or improvise
  lower-level deletion commands. Never reuse an existing D1 database or R2
  bucket unless the CLI identifies it and the user explicitly approves that
  exact resource.

## User-facing language

- Assume the user does not know Cloudflare terminology. Ask for a **site
  name**, not an "instance" or "Worker name." Explain that it is a short name
  for the new microfeed and helps form its web address.
- Before asking for the site name, recommend choosing a globally unique,
  distinctive name even though Cloudflare technically scopes Worker names to
  an account. If the user plans to use a custom web address, recommend
  replacing its dots with hyphens: for `my.domainname.com`, suggest
  `my-domainname-com`.
- Ask for the **email used to sign in as administrator**, not an "owner
  email." Explain that this creates the first protected dashboard login.
- Do not ask the user to name D1 or R2 resources unless they request advanced
  customization. Derive their names from the site name using the documented
  defaults.
- Ask about a custom web address in plain language and make clear it is
  optional and can be added later.
- Keep terms such as Worker, D1, R2, instance, binding, and OAuth out of the
  initial questions. Introduce them only when needed for an approval or error,
  and immediately explain what each resource does in plain language.
- Never ask for all configuration fields at once. Start with: "Choose a
  globally unique site name. If you plan to use a custom web address, replace
  its dots with hyphens—for example, `my.domainname.com` becomes
  `my-domainname-com`. What would you like to call your site, and what email
  would you like to use to sign in as administrator?" State separately that
  the user must not send a password in chat. After receiving those answers,
  always ask: "Would you like to use your own web address (for example,
  `feed.example.com`), or start with the free Cloudflare address? You can add
  your own address later." Do not start initialization until this choice is
  explicit, unless the user already supplied it.

## Deployment readiness checklist

Show a short, plain-language checklist when deployment begins. Reprint the
updated checklist after every completed milestone, before each user handoff,
and in the final report. Use `✅` for complete, `⏳` for the current action,
and `⬜` for pending. Never mark a skipped or unverified step complete.

Use these checks, adapting labels without exposing secrets:

- Local project and required software are ready
- Cloudflare sign-in is authorized
- Cloudflare account is selected
- Site choices are confirmed
- Site and content database are deployed
- Media storage is ready, explicitly disabled, or clearly marked as pending
  Cloudflare activation
- Public site is verified
- Administrator password is created and protected login is active
- Web address choice is complete: custom address verified, or free Cloudflare
  address explicitly accepted

Keep user handoffs next to the relevant pending item. A deployment is not
fully ready until every applicable check is complete. If a step fails, show it
as pending with a one-sentence recovery action; do not imply that earlier
successful steps were undone.

## Choose the management command

- Cloudflare authorization/account discovery: `yarn manage accounts --json`
- Separate named Cloudflare login: `yarn manage accounts --profile <name>`
- Fresh authorization for a named login: `yarn manage accounts --profile <name> --reauthorize`
- Fresh Cloudflare installation: `yarn manage init`
- Saved Cloudflare installation: `yarn manage deploy`
- Explicitly enable deferred media storage: `yarn manage deploy --enable-r2`
- Explicitly enable production webhooks:
  `yarn manage deploy --enable-webhooks --instance <instance-name>`
- Explicitly enable preview webhooks:
  `yarn manage deploy --preview --enable-webhooks --instance <instance-name>`
- Disable production webhook infrastructure while retaining its Queue and
  encryption secret:
  `yarn manage deploy --disable-webhooks --instance <instance-name>`
- Disable preview webhook infrastructure independently:
  `yarn manage deploy --preview --disable-webhooks --instance <instance-name>`
- Disable local Queue and Cron simulation for one run only:
  `yarn dev --disable-webhooks --instance <instance-name>`
- Prepare an `init --local` instance without starting it: `yarn manage deploy --local`
- Existing compatible Worker not saved in this clone: `yarn manage connect`;
  connecting is read-only, so ask again before a later deployment
- Isolated local development server: `yarn manage dev`
- Theme initialization and live version management: `yarn manage theme`; use
  [`export-microfeed-theme`](../export-microfeed-theme/SKILL.md) when creating
  or exporting a standalone authoring repository
- Portable backup or restore: `yarn manage snapshot`
- Diagnostics only: `yarn manage status`
- Destruction plan or removal: `yarn manage destroy`
- Side-by-side migration from Cloudflare Pages: `yarn manage migrate-pages`
- Production custom domain: `yarn manage domain`
- Optional user-managed Cloudflare Access: `yarn manage access`
- Administrator login or dashboard-path changes: `yarn manage auth`
- Generate and validate local configuration: `yarn manage config`
- List or select saved instances: `yarn manage instances` or `yarn manage use`
- Isolated preview after production exists: `yarn manage init --preview`

Use `init --no-r2` only when the user explicitly wants a content-only or test
installation. It works for Cloudflare and local initialization, saves the
future bucket name, and must not be combined with preview or reuse approval.
Preview and Cloudflare snapshot operations require production R2 to be ready.

Use `--instance <name>` whenever more than one saved instance exists or the
user named a target. Do not deploy a local-only instance to Cloudflare.

When the user asks to enable webhooks, repeat the exact target environment.
Explain that first enablement creates one dedicated Queue and encryption secret,
while later enables verify and reuse their exact saved identities. An ordinary
deployment preserves the saved state: enabled remains enabled, disabled remains
detached, and unprovisioned remains off. Follow the normal dirty-checkout and
Cloudflare authorization guardrails, run only the appropriate command above,
then verify with `yarn manage status --instance <instance-name>` and report the
Queue ID, producer binding, Worker consumer, delivery state, and Cron result.
Do not infer preview from production or production from preview.

When the user asks to stop one webhook integration, guide them to **Admin →
Webhooks → Endpoints** to disable or delete that endpoint. When they ask to stop
webhook infrastructure or periodic Worker checks, use the exact production or
preview `--disable-webhooks` command above after repeating the target. Explain
that it cancels pending deliveries, purges queued messages, and removes the
producer, consumer, and every Cron while retaining endpoint data, delivery
history, the dedicated Queue, and the encryption secret. Events during the
disabled interval are not replayed. Rerunning enable or disable is idempotent;
never recreate, rename, adopt, purge, resume, or delete the Queue outside
`yarn manage`.

## Prepared-workspace workflow

1. When the published launcher handed off this skill, use its printed cached
   repository and reference paths and keep using the public `npx` command
   prefix. The launcher has already verified the bundled release source and run
   `yarn install --immutable` with its pinned Yarn runtime; do not edit the
   cached source or run a second checkout. In a user-managed clone, confirm the
   repository root contains `package.json`, `yarn.lock`, and
   `manage-cli/index.ts`.
2. Require Node.js 22.12 or newer with npm for the public `npx` invocation.
   Ordinary deployment through the published launcher does not require Git or
   Corepack. Git is command-specific for installing or updating a theme from
   GitHub, initializing a theme repository unless `--no-git` is passed, and
   `theme export --git`. In a user-managed clone, check its normal development
   tools directly and obtain approval before a command writes outside the
   workspace.
3. In a user-managed clone, before any command receives OAuth input, obtain
   network approval and run `yarn install --immutable --check-cache`. This must
   revalidate the locked packages and relink local dependencies even when
   `node_modules` already exists, unless the same trusted session just
   completed that exact command. The launcher-owned workspace has already
   completed its locked installation.
4. Do not assume the user needs a new site. Discover their Cloudflare access
   before collecting new-site choices or making any deployment mutation:

   ```console
   yarn manage accounts --json
   ```

   Explain that Wrangler may open Cloudflare in the browser and stores the
   resulting OAuth credentials through its OS keyring support. Explain that a
   profile is a saved Cloudflare login, while an account is a Cloudflare
   workspace that owns sites and data. The output lists every stored profile,
   marks the one active for this repository, shows only that login's accounts,
   and prints commands for switching to other named profiles. If authorization
   is required, pause for the user to finish it, then resume the command. If no
   usable account appears, offer `yarn manage accounts --reauthorize`. If the
   user wants to preserve the current login and add another, use
   `yarn manage accounts --profile <name> --reauthorize` instead. Do not work
   around OAuth with a token.
5. When exactly one account is returned, use its full ID. When several are
   returned, show each plain-language account name and the last eight ID
   characters, then ask the user which one owns the site. Duplicate names are
   expected; use the selected full ID. Never select the first account, and
   never begin initialization before this choice is resolved.
6. Run `yarn manage instances --account-id <account-id> --json`. Use the
   selected saved instance when one exists. Otherwise show every exact
   compatible Worker candidate. Ask the user to choose when more than one is
   available, then use the ready-to-run read-only `connect` command for the
   chosen Worker and continue with **Existing installations**. Continue below
   only when no compatible Worker is selected and the user wants a new site.
   Collect the new site's non-secret choices in plain language. Ask only for
   the site name and administrator sign-in email initially. Then require an
   explicit choice between a custom web address and the free Cloudflare
   address; do not silently assume either. If the user wants a custom address,
   collect its exact hostname. Map those answers to the internal values and
   recommend the documented defaults:
   - site name, internally used as the instance and Worker name: the user's
     globally distinctive name
   - content database (D1): `<worker-name>-db`
   - media storage (R2): `<worker-name>-media`
   - dashboard path (`--admin-path`): `admin`
   - authentication: built-in email/password
   - administrator sign-in email, internally passed as owner email: supplied by
     the user
   - custom domain: optional; collect an exact hostname when selected
7. Summarize the selected site and the services Cloudflare will create in
   plain language: the hosted application (Worker), content database (D1),
   optional media storage (R2), protected dashboard path and administrator
   login, and optional custom web address. Show the exact technical resource
   names in parentheses for an auditable approval. Obtain approval for the
   browser Cloudflare sign-in and exact Cloudflare changes before starting the
   initialization command.
8. Start initialization with every known non-secret choice and the exact
   account ID so the user is not asked twice:

   ```console
   yarn manage init --instance <instance> --project-name <worker> \
     --account-id <account-id> \
     --d1-name <database> --r2-name <bucket> --admin-path <path> \
     --admin-auth built-in --owner-email <email> --yes
   ```

   Omit `--owner-email` when built-in authentication is not selected. Never add
   `--admin-password`. If `--yes` is inappropriate because the user asked for
   interactive customization, still supply `--account-id` and every answer
   already known.

   Add `--no-r2` only after the user deliberately opts out. If Cloudflare
   instead returns `10042` / `NotEntitled`, accept the CLI's verified
   content-only completion. Relay its account-specific R2 dashboard link and
   explain that activation and any payment method or billing consent must be
   completed by the user in Cloudflare; never attempt that consent yourself.
9. If initialization is interrupted, rerun the identical command. Rely on the
   CLI's saved state and resource checks; do not bypass a collision or add a
   reuse flag unless the user approves the exact resource. When Wrangler says
   a `workers.dev` subdomain must be registered during a newly created
   account's first Worker deployment, treat it as temporary account
   preparation and do not relay Wrangler's onboarding link. For an
   agent-driven run, wait about 60 seconds and rerun the identical init command
   once. If it persists, relay the CLI's guidance so the user can wait a few
   minutes before trying again.
10. Honor the recorded web-address choice. If the user selected a custom web
    address, run:

    ```console
    yarn manage domain --instance <instance> --hostname <hostname> \
      --account-id <account-id> --yes
    ```

    A hostname change while password setup is pending rotates the one-time
    token. Discard the earlier URL and relay only the new final-hostname URL.
    If the user selected the free Cloudflare address, mark that checklist item
    complete without creating DNS or a custom domain. If the choice was never
    recorded, stop and ask before continuing.
11. Find the final one-time URL in the management command's output. Explain
    that the dashboard deliberately returns HTTP 403 until the user opens this
    private link and chooses a 12–128 character password in the browser. Relay
    the URL, wait for the user to say browser setup succeeded, and never handle
    the password yourself.
12. Verify the finished installation:

    ```console
    yarn manage status --instance <instance> --account-id <account-id>
    ```

    If status reports a healthy deployment with password setup still pending,
    do not call the deployment failed. Relay the newest link if this run has
    one, wait for browser completion, and rerun status. If the link expired or
    is missing, run `yarn manage auth setup` with the same instance and account
    ID to rotate it.
13. Report the verified public URL, dashboard URL, site name, Worker, D1
    database, R2 bucket and setup state, authentication mode, and custom domain status. Include
    the completed readiness checklist. Warn and stop if the status command says
    the admin dashboard is public.

## Existing installations

With published-launcher state, start with `accounts --json`; when several
accounts are available, show their names and ID suffixes and ask the user to
select one. Then run `instances --account-id <account-id> --json`. Use the
selected saved instance when one exists. Otherwise show every exact compatible
Worker candidate, ask the user to choose when more than one is available, and
run the listed read-only `connect` command for the selected Worker. Obtain
deployment approval before `deploy`. Run `init` only when the user chooses a
new site rather than a discovered installation.

Before updating, show the selected instance with `yarn manage instances` and
confirm the target. Run `yarn manage accounts --json`, verify that the saved
full account ID is still available, then run `yarn manage deploy --instance
<instance> --account-id <account-id>` and `yarn manage status --instance
<instance> --account-id <account-id>`. Use `--preview` consistently when the
user selected the isolated preview environment.

If `instances` or `status` reports automatic pending media, a non-interactive
agent deployment leaves it content-only and prints the deterministic enable
command. Ask whether the user wants to activate media storage. After the user
has enabled R2 and accepted any Cloudflare billing terms in the dashboard, run
`yarn manage deploy --enable-r2 --instance <instance> --account-id
<account-id>`. A same-named bucket still needs approval for that exact reuse;
add `--reuse-r2` only after receiving it. If media is recorded as disabled,
ordinary deploys stay quiet and the same explicit enable command is the opt-in.

For a local-only instance, use `yarn manage deploy --local --instance
<instance>` to apply local migrations and run checks/build without starting a
server. Add `--enable-r2` only when the user wants to permanently add the
simulated local media binding.

Treat an authentication, permission, name-collision, Pages-domain, or
verification failure as actionable. Preserve the CLI's error, explain the next
safe step, and rerun the same management command after the user resolves it. Do
not work around the failure with lower-level Cloudflare tooling.

Webhook lifecycle commands perform retried, read-only D1 and Queue access
preflight before changing infrastructure. If Cloudflare returns authentication
code `10000`, use the exact fresh-process command printed by `yarn manage`.
Never substitute a raw Wrangler command. A failure before the preflight leaves
the Queue untouched; a later failure leaves a recorded transition that the
same command resumes safely.

## Destruction workflow

1. Treat requests to delete, destroy, remove, uninstall, or tear down a site as
   destructive authorization only after the target is unambiguous. Do not infer
   permission to delete from a request that merely asks how deletion works.
2. Inspect the working tree under the same security-sensitive rules used for
   deployment. Select the saved site and verify its saved Cloudflare account is
   available.
3. Always begin with the read-only plan:

   ```console
   yarn manage destroy --instance <instance-name> --account-id <account-id> --dry-run
   ```

   Add `--preview` only when the user selected the preview. Never destroy
   production while its preview exists; remove preview first as instructed by
   the CLI.
4. Relay the complete plan in plain language, including the site and account,
   public address, hosted application, database ID and name, media bucket,
   webhook Queue name, Queue ID, state, ownership, exact consumer, backlog,
   Cron schedules, custom address, reused/preserved status, local instance
   folder, and every dashboard inspection URL. Explain that confirmed
   destruction verifies and detaches only the saved Worker's Queue consumer,
   then deletes the instance-specific Queue even with `--keep-data`, while D1
   and R2 may be preserved. Owned Cloudflare data deletion is
   permanent and that the local folder includes a separate development
   database and media sandbox. Ask whether the user wants to keep Cloudflare
   data; add `--keep-data` only when they explicitly choose it.
5. Obtain explicit approval for that exact plan. Then run:

   ```console
   yarn manage destroy --instance <instance-name> --account-id <account-id> \
     --confirm <instance-name>
   ```

   Preserve `--preview` or `--keep-data` from the approved plan. Do not use
   `--yes`; do not substitute the confirmation value.
6. Show a destruction checklist through the handoff:
   - dry-run inventory reviewed;
   - exact deletion approved;
   - hosted application and custom address absent;
   - owned database absent or explicitly preserved;
   - owned media storage absent or explicitly preserved;
   - webhook Queue absent and Cron schedules removed;
   - local instance folder and development sandbox removed;
   - final Workers & Pages, D1, R2, and Queues list checks reported.
7. If interrupted, rerun the identical confirmed command. Rely on the CLI's
   recorded steps, identity checks, and replacement-resource refusal. Never
   clear its progress markers or delete a same-named replacement manually.
8. Report automatic deletion and preserved resources separately. Do not inspect
   or change Zero Trust or SSL settings. Relay the final account-specific
   Workers & Pages, D1, R2, and Queues dashboard links, the exact name to find on each
   page, and whether it should be absent or preserved. Ask the user to refresh
   the lists if Cloudflare has not reflected the change yet.
