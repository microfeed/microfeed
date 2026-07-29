---
name: deploy-microfeed
description: Deploy and administer microfeed on Cloudflare from a local repository clone using the project-owned yarn admin CLI. Use when a user asks Codex to install, set up, deploy, publish, update, connect, check, configure, destroy, remove, or uninstall a microfeed Worker, D1 database, R2 bucket, admin login, preview environment, or custom domain.
---

# Deploy microfeed

Use `yarn admin` as the only interface that changes Cloudflare. Do not replace
the CLI workflow with raw Wrangler commands, Cloudflare API calls, an MCP
server, a plugin, or dashboard-created Worker, D1, or R2 resources.

Read the relevant command section in the canonical
[`yarn admin` reference](../../../docs/admin-cli.md) before using an unfamiliar
command or option. Treat that document as the complete capability and
side-effect contract; keep this skill focused on agent sequencing and safety.

## Guardrails

- Use this workflow only from local Codex with a browser that can complete
  Wrangler's local OAuth callback. Do not attempt it from hosted or headless
  Codex.
- Never request a password or Cloudflare token in chat. Never use
  `--admin-password`; that deliberately unsafe option exists only for
  non-Codex automation whose operator accepts shell-history, process-list,
  transcript, and CI-log exposure.
- Relay the one-time password-creation URL printed by `yarn admin` exactly once
  so the user can open it. Treat it as private: never ask the user to paste it
  back, write it to a file, reuse it in another command, or expose it after it
  has served its handoff.
- Stop before deployment when the Wrangler browser OAuth callback is
  unavailable.
- Inspect `git status --short` before deploying. If the working tree is dirty,
  identify that the current files will be built and obtain explicit approval
  to deploy them. Do not modify, discard, or stash the changes.
- Treat changes to `package.json`, `yarn.lock`, `.yarn/`, `admin-cli/`,
  `wrangler.jsonc`, `wrangler.template.jsonc`, `astro.config.ts`, or this skill
  as security-sensitive because deployment executes or trusts them. Inspect
  their diffs and any untracked files, name them to the user, and recommend a
  clean trusted checkout. Continue only when the user explicitly trusts those
  exact changes; a generic approval of a dirty tree is insufficient.
- Explain the external changes before starting: a fresh setup can create a
  Worker, D1 database, R2 bucket, Worker secrets, and, only when selected, a
  Worker Custom Domain with Cloudflare-managed DNS and certificates.
- Delete a deployment only through `yarn admin destroy`, after its dry run and
  explicit approval of the exact resource list. Never delete reused data,
  bypass identity or replacement-resource checks, pass `--yes`, or improvise
  lower-level deletion commands. Never reuse an existing D1 database or R2
  bucket unless the CLI identifies it and the user explicitly approves that
  exact resource.

## User-facing language

- Assume the user does not know Cloudflare terminology. Ask for a **site
  name**, not an "instance" or "Worker name." Explain that it is a short name
  for the new microfeed and helps form its web address.
- Ask for the **email used to sign in as administrator**, not an "owner
  email." Explain that this creates the first protected admin login.
- Do not ask the user to name D1 or R2 resources unless they request advanced
  customization. Derive their names from the site name using the documented
  defaults.
- Ask about a custom web address in plain language and make clear it is
  optional and can be added later.
- Keep terms such as Worker, D1, R2, instance, binding, and OAuth out of the
  initial questions. Introduce them only when needed for an approval or error,
  and immediately explain what each resource does in plain language.
- Never ask for all configuration fields at once. Start with: "What would you
  like to call your site, and what email would you like to use to sign in as
  administrator?" State separately that the user must not send a password in
  chat. After receiving those answers, always ask: "Would you like to use your
  own web address (for example, `feed.example.com`), or start with the free
  Cloudflare address? You can add your own address later." Do not start setup
  until this choice is explicit, unless the user already supplied it.

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
- Site, content database, and media storage are deployed
- Public site is verified
- Administrator password is created and protected login is active
- Web address choice is complete: custom address verified, or free Cloudflare
  address explicitly accepted

Keep user handoffs next to the relevant pending item. A deployment is not
fully ready until every applicable check is complete. If a step fails, show it
as pending with a one-sentence recovery action; do not imply that earlier
successful steps were undone.

## Choose the admin command

- Cloudflare authorization/account discovery: `yarn admin accounts --json`
- Fresh authorization under another login: `yarn admin accounts --reauthorize`
- Fresh Cloudflare installation: `yarn admin setup`
- Saved Cloudflare installation: `yarn admin deploy`
- Existing compatible Worker not saved in this clone: `yarn admin connect`;
  connecting is read-only, so ask again before a later deployment
- Diagnostics only: `yarn admin status`
- Destruction plan or removal: `yarn admin destroy`
- Production custom domain: `yarn admin domain`
- Admin login or path changes: `yarn admin auth`
- Isolated preview after production exists: `yarn admin setup --preview`

Use `--instance <name>` whenever more than one saved instance exists or the
user named a target. Do not deploy a local-only instance to Cloudflare.

## Fresh-clone workflow

1. Confirm the repository root contains `package.json`, `yarn.lock`, and
   `admin-cli/index.ts`.
2. Check `node --version` and require Node.js 24. Check Corepack and enable it
   when Yarn is unavailable. Obtain approval before a command writes outside
   the workspace.
3. Before any command receives OAuth input, obtain network
   approval and run `yarn install --immutable --check-cache`. This must
   revalidate the locked packages and relink local dependencies even when
   `node_modules` already exists, unless the same trusted session just
   completed that exact command.
4. Collect non-secret choices in the plain language described above. Ask only
   for the site name and admin sign-in email initially. Then require an
   explicit choice between a custom web address and the free Cloudflare
   address; do not silently assume either. If the user wants a custom address,
   collect its exact hostname. Map those answers to the internal values and
   recommend the documented defaults:
   - site name, internally used as the instance and Worker name: `microfeed`
   - content database (D1): `<worker-name>-db`
   - media storage (R2): `<worker-name>-media`
   - admin path: `admin`
   - authentication: built-in email/password
   - admin sign-in email, internally passed as owner email: supplied by the user
   - custom domain: optional; collect an exact hostname when selected
5. Discover the user's Cloudflare access before any deployment mutation:

   ```console
   yarn admin accounts --json
   ```

   Explain that Wrangler may open Cloudflare in the browser and stores the
   resulting OAuth credentials through its OS keyring support. If authorization
   is required, pause for the user to finish it, then resume the command. If no
   usable account appears, offer `yarn admin accounts --reauthorize`; do not
   work around OAuth with a token.
6. When exactly one account is returned, use its full ID. When several are
   returned, show each plain-language account name and the last eight ID
   characters, then ask the user which one owns the site. Duplicate names are
   expected; use the selected full ID. Never select the first account, and
   never begin setup before this choice is resolved.
7. Summarize the selected site and the services Cloudflare will create in
   plain language: the hosted application (Worker), content database (D1),
   media storage (R2), protected admin path and login, and optional custom web
   address. Show the exact technical resource names in parentheses for an
   auditable approval. Obtain approval for the browser Cloudflare sign-in and
   exact Cloudflare changes before starting any setup command.
8. Start setup with every known non-secret choice and the exact account ID so
   the user is not asked twice:

   ```console
   yarn admin setup --instance <instance> --project-name <worker> \
     --account-id <account-id> \
     --d1-name <database> --r2-name <bucket> --admin-path <path> \
     --admin-auth built-in --owner-email <email> --yes
   ```

   Omit `--owner-email` when built-in authentication is not selected. Never add
   `--admin-password`. If `--yes` is inappropriate because the user asked for
   interactive customization, still supply `--account-id` and every answer
   already known.
9. If setup is interrupted, rerun the identical command. Rely on the CLI's
   saved state and resource checks; do not bypass a collision or add a reuse
   flag unless the user approves the exact resource.
10. Honor the recorded web-address choice. If the user selected a custom web
    address, run:

    ```console
    yarn admin domain --instance <instance> --hostname <hostname> \
      --account-id <account-id> --yes
    ```

    A hostname change while password setup is pending rotates the one-time
    token. Discard the earlier URL and relay only the new final-hostname URL.
    If the user selected the free Cloudflare address, mark that checklist item
    complete without creating DNS or a custom domain. If the choice was never
    recorded, stop and ask before continuing.
11. Find the final one-time URL in the admin command's output. Explain that the
    dashboard deliberately returns HTTP 403 until the user opens this private
    link and chooses a 12–128 character password in the browser. Relay the URL,
    wait for the user to say browser setup succeeded, and never handle the
    password yourself.
12. Verify the finished installation:

    ```console
    yarn admin status --instance <instance> --account-id <account-id>
    ```

    If status reports a healthy deployment with password setup still pending,
    do not call the deployment failed. Relay the newest link if this run has
    one, wait for browser completion, and rerun status. If the link expired or
    is missing, run `yarn admin auth setup` with the same instance and account
    ID to rotate it.
13. Report the verified public URL, admin URL, site name, Worker, D1
    database, R2 bucket, authentication mode, and custom domain status. Include
    the completed readiness checklist. Warn and stop if the status command says
    the admin dashboard is public.

## Existing installations

Before updating, show the selected instance with `yarn admin instances` and
confirm the target. Run `yarn admin accounts --json`, verify that the saved
full account ID is still available, then run `yarn admin deploy --instance
<instance> --account-id <account-id>` and `yarn admin status --instance
<instance> --account-id <account-id>`. Use `--preview` consistently when the
user selected the isolated preview environment.

Treat an authentication, permission, name-collision, Pages-domain, or
verification failure as actionable. Preserve the CLI's error, explain the next
safe step, and rerun the same admin command after the user resolves it. Do not
work around the failure with lower-level Cloudflare tooling.

## Destruction workflow

1. Treat requests to delete, destroy, remove, uninstall, or tear down a site as
   destructive authorization only after the target is unambiguous. Do not infer
   permission to delete from a request that merely asks how deletion works.
2. Inspect the working tree under the same security-sensitive rules used for
   deployment. Select the saved site and verify its saved Cloudflare account is
   available.
3. Always begin with the read-only plan:

   ```console
   yarn admin destroy --instance <instance> --account-id <account-id> --dry-run
   ```

   Add `--preview` only when the user selected the preview. Never destroy
   production while its preview exists; remove preview first as instructed by
   the CLI.
4. Relay the complete plan in plain language, including the site and account,
   public address, hosted application, database ID and name, media bucket,
   custom address, reused/preserved status, local instance folder, and every
   dashboard inspection URL. Explain that owned Cloudflare data deletion is
   permanent and that the local folder includes a separate development
   database and media sandbox. Ask whether the user wants to keep Cloudflare
   data; add `--keep-data` only when they explicitly choose it.
5. Obtain explicit approval for that exact plan. Then run:

   ```console
   yarn admin destroy --instance <instance> --account-id <account-id> \
     --confirm <instance>
   ```

   Preserve `--preview` or `--keep-data` from the approved plan. Do not use
   `--yes`; do not substitute the confirmation value.
6. Show a destruction checklist through the handoff:
   - dry-run inventory reviewed;
   - exact deletion approved;
   - hosted application and custom address absent;
   - owned database absent or explicitly preserved;
   - owned media storage absent or explicitly preserved;
   - local instance folder and development sandbox removed;
   - final Workers & Pages, D1, and R2 list checks reported.
7. If interrupted, rerun the identical confirmed command. Rely on the CLI's
   recorded steps, identity checks, and replacement-resource refusal. Never
   clear its progress markers or delete a same-named replacement manually.
8. Report automatic deletion and preserved resources separately. Do not inspect
   or change Zero Trust or SSL settings. Relay the final account-specific
   Workers & Pages, D1, and R2 dashboard links, the exact name to find on each
   page, and whether it should be absent or preserved. Ask the user to refresh
   the lists if Cloudflare has not reflected the change yet.
