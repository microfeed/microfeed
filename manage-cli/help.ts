export interface CliCommandOption {
  description: string;
  syntax: string;
}

export interface CliCommandMetadata {
  changes: string;
  details: string[];
  examples: string[];
  name: string;
  options: CliCommandOption[];
  summary: string;
  usage: string;
}

const option = (
  syntax: string,
  description: string,
): CliCommandOption => ({description, syntax});

export const CLI_COMMANDS: readonly CliCommandMetadata[] = [
  {
    changes: "Read-only Cloudflare discovery; may update local OAuth profiles and the repository binding.",
    details: [
      "Checks the current Wrangler login and required permissions, opening browser authorization when needed.",
      "With --profile, creates or selects a named Wrangler login and binds it to this local repository without changing Cloudflare resources.",
      "A profile is a Cloudflare login saved on this computer; an account is a Cloudflare workspace that owns sites and data.",
      "Lists every stored profile, marks the active one, shows only that login's accounts, and prints commands for switching to other named profiles.",
    ],
    examples: [
      "yarn manage accounts",
      "yarn manage accounts --json",
      "yarn manage accounts --profile company",
      "yarn manage accounts --profile company --reauthorize",
      "yarn manage accounts --reauthorize",
    ],
    name: "accounts",
    options: [
      option("--json", "Print machine-readable identity and account data."),
      option("--profile <name>", "Create or select a named Wrangler login for this repository."),
      option("--reauthorize", "Force a fresh browser authorization."),
    ],
    summary: "Authorize Cloudflare and list available accounts.",
    usage: "yarn manage accounts [--json] [--profile <name>] [--reauthorize]",
  },
  {
    changes: "Creates or updates Cloudflare resources, or creates an isolated local sandbox with --local.",
    details: [
      "Choose a globally unique site name; for a custom address such as my.domainname.com, use my-domainname-com.",
      "Production initialization creates or reuses a Worker, D1 database, R2 bucket, secrets, migrations, and optional custom domain.",
      "Preview initialization creates a separate Worker and D1 database while reusing production media storage.",
      "Authentication is confirmed before creating D1 or R2 resources, an interrupted retry preserves whether each saved resource is owned or reused, and the restore fingerprint is recorded after all initialization steps finish.",
      "Built-in authentication normally prints a private browser link for setting the first password.",
      "A completed installation stops with guidance to use deploy, status, domain, or auth instead.",
    ],
    examples: [
      "yarn manage init",
      "yarn manage init --preview",
      "yarn manage init --local",
    ],
    name: "init",
    options: [
      option("--instance <name>", "Select the saved site name."),
      option("--account-id <id>", "Use one exact Cloudflare account."),
      option(
        "--project-name <name>",
        "Set the Worker name: 1–63 ASCII letters, numbers, or hyphens; no edge hyphen.",
      ),
      option("--d1-name <name>", "Set the production or preview D1 database name."),
      option("--r2-name <name>", "Set the production R2 bucket name; preview always reuses production storage."),
      option("--admin-path <path>", "Set the Cloudflare dashboard path, defaulting to admin."),
      option("--admin-auth <built-in|none>", "Enable the built-in login or deliberately leave the dashboard unprotected."),
      option("--owner-email <email>", "Set the first administrator sign-in email."),
      option("--admin-password <value>", "Unsafe remote-only automation option; exposes the password through process arguments."),
      option("--no-open", "Print a browser password link without opening it automatically."),
      option("--reuse-d1", "Explicitly approve reuse of a same-named existing D1 database."),
      option("--reuse-r2", "Explicitly approve reuse of a same-named existing production R2 bucket."),
      option("--preview", "Create or resume the isolated preview environment."),
      option("--local", "Create or resume a local-only development instance."),
      option("--yes", "Accept non-secret remote defaults; local first-password setup remains interactive."),
    ],
    summary: "Initialize or resume a production, preview, or local installation.",
    usage: "yarn manage init [--instance <name>] [--preview|--local] [options]",
  },
  {
    changes: "Reads Cloudflare and writes local connection state; does not change Cloudflare.",
    details: [
      "Discovers compatible existing microfeed Workers, verifies public installation identity, and saves the selected deployment in this clone.",
      "Connected D1 and R2 resources are recorded as reused so later destruction will preserve them.",
    ],
    examples: [
      "yarn manage connect",
      "yarn manage connect --account-id <id> --worker existing-feed --instance personal",
    ],
    name: "connect",
    options: [
      option("--account-id <id>", "Search one exact Cloudflare account."),
      option("--worker <name>", "Select an exact compatible Worker."),
      option("--instance <name>", "Choose the local saved name for the connection."),
      option("--yes", "Run non-interactively; requires --worker when several matches exist."),
    ],
    summary: "Connect an existing Cloudflare microfeed to this clone.",
    usage: "yarn manage connect [--account-id <id>] [--worker <name>] [--instance <name>]",
  },
  {
    changes: "Updates the selected Cloudflare Worker and applies D1 migrations.",
    details: [
      "Runs type checks, tests, and a build before deploying, then verifies the public site and protected admin route.",
    ],
    examples: [
      "yarn manage deploy --instance personal",
      "yarn manage deploy --preview --instance personal",
    ],
    name: "deploy",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Deploy the saved preview environment."),
    ],
    summary: "Check, migrate, deploy, and verify a saved installation.",
    usage: "yarn manage deploy [--instance <name>] [--preview]",
  },
  {
    changes: "Starts a local server and changes only isolated local D1/R2 simulation data.",
    details: [
      "Generates the selected local Wrangler configuration, applies local migrations, and starts Astro development.",
      "A connected Cloudflare installation still uses isolated local data; production D1 and R2 are never synchronized.",
    ],
    examples: [
      "yarn manage dev --instance personal",
      "yarn manage dev --preview --instance personal",
    ],
    name: "dev",
    options: [
      option("--instance <name>", "Select the local or connected site sandbox."),
      option("--preview", "Use the saved preview configuration with isolated local data."),
    ],
    summary: "Run one site locally with isolated development data.",
    usage: "yarn manage dev [--instance <name>] [--preview]",
  },
  {
    changes: "Creates a read-only export, restores a new local instance, or replaces the data in one explicitly confirmed fresh Cloudflare target.",
    details: [
      "Actions: create packages D1 schema/data and the whole R2 bucket; pull creates that package and restores a new local instance; restore validates and imports one package.",
      "Every archive records the exact applied migration filenames and SHA-256 hashes. Restore recreates that historical schema and ledger, then applies this checkout's newer migrations.",
      "Long-running create and restore phases show an animated elapsed-time indicator with brief D1, migration, R2, and verification updates.",
      "Archive validation and target readiness are separate checks. A valid archive is not restorable until fresh-target validation also succeeds.",
      "If a completed initialization is missing its fingerprint, an interactive --dry-run can repair the local safety record only after read-only Worker, D1, migration, bootstrap-data, installation-identity, and R2 checks pass.",
      "A successful repair check automatically saves the fingerprint in local instance configuration and continues the dry run. It changes no Cloudflare data, and the dry run never imports the snapshot.",
      "After an interrupted restore has uploaded media, --dry-run reports exact missing or extra R2 objects, byte-size differences, and metadata differences from the previous attempt without uploading again.",
      "After multipart uploads complete, R2 verification retries for up to one minute while keeping the progress indicator active, then reports exact differences if the inventory still does not match.",
      "When a restored local snapshot has no administrator account, completion prints the exact auth setup command for the new instance.",
      "Remote restore requires a newly initialized target with nonreused, unchanged D1 and R2 resources. Run --dry-run before confirming the exact instance name.",
      "During maintenance, a token-protected workers.dev control endpoint is temporarily enabled so custom-domain DNS or Access cannot interrupt the restore; normal deployment disables it again on success.",
      "Archives contain administrator credentials and private media, are unencrypted, and are created with owner-only file permissions.",
    ],
    examples: [
      "yarn manage snapshot create --instance production --output backup.tar.gz",
      "yarn manage snapshot pull --instance production --local-instance production-copy",
      "yarn manage snapshot restore --file backup.tar.gz --local --instance restored-local",
      "yarn manage snapshot restore --file backup.tar.gz --instance restored-cloudflare --dry-run",
      "yarn manage snapshot restore --file backup.tar.gz --instance restored-cloudflare --confirm restored-cloudflare",
    ],
    name: "snapshot",
    options: [
      option("--instance <name>", "Select the source or restore target instance."),
      option("--output <file>", "Choose a new .tar.gz output path for create or pull."),
      option("--local-instance <name>", "Choose the new local instance created by pull."),
      option("--file <file>", "Read this portable .tar.gz archive for restore."),
      option("--local", "Restore into a new local-only instance."),
      option("--dry-run", "Validate and print a remote restore plan without changing Cloudflare data; it may repair a missing local safety fingerprint after confirmation."),
      option("--confirm <name>", "Approve a remote restore by exactly matching the fresh target instance."),
    ],
    summary: "Create, download, validate, and restore migration-safe portable snapshots.",
    usage: "yarn manage snapshot <create|pull|restore> [options]",
  },
  {
    changes: "Read-only Cloudflare and public-site verification.",
    details: [
      "Checks the Worker, exact D1 identity, R2 bucket, public URL, administrator state, pending password link, and dashboard protection.",
      "Returns an actionable failure when a required resource or protection check is missing.",
    ],
    examples: [
      "yarn manage status --instance personal",
      "yarn manage status --preview --instance personal",
    ],
    name: "status",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Check the preview environment."),
    ],
    summary: "Verify Cloudflare resources, the public site, and dashboard protection.",
    usage: "yarn manage status [--instance <name>] [--preview]",
  },
  {
    changes: "Permanently deletes owned Cloudflare resources and local instance data unless explicitly preserved.",
    details: [
      "Always run --dry-run first. The plan includes exact identities, expected actions, and Cloudflare inspection links.",
      "The command refuses --yes, requires an exact typed or --confirm name, preserves reused resources, and resumes recorded partial deletion safely.",
      "Production cannot be destroyed while its preview still exists.",
    ],
    examples: [
      "yarn manage destroy --instance personal --dry-run",
      "yarn manage destroy --instance personal --confirm personal",
      "yarn manage destroy --instance personal --keep-data --confirm personal",
    ],
    name: "destroy",
    options: [
      option("--instance <name>", "Select the exact saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Target the preview environment; destroy it before production."),
      option("--dry-run", "Print the read-only deletion plan and inspection links."),
      option("--confirm <name>", "Confirm deletion by exactly matching the saved site name."),
      option("--keep-data", "Preserve owned D1 and R2 data while deleting the Worker and local state."),
    ],
    summary: "Inspect and safely remove a saved Cloudflare deployment.",
    usage: "yarn manage destroy --instance <name> [--preview] [--dry-run|--confirm <name>] [--keep-data]",
  },
  {
    changes: "Creates a side-by-side Worker and local state; reuses but does not modify or delete the Pages project, D1, or R2.",
    details: [
      "Discovers a Pages project and its existing D1/R2 resources, then deploys a differently named Worker for verification before manual traffic cutover.",
      "Preview mode is not supported because the migration Worker is already side by side.",
    ],
    examples: [
      "yarn manage migrate-pages",
      "yarn manage migrate-pages --pages-name legacy-feed --project-name legacy-feed-worker",
    ],
    name: "migrate-pages",
    options: [
      option("--account-id <id>", "Use one exact Cloudflare account."),
      option("--instance <name>", "Choose the new local saved site name."),
      option("--pages-name <name>", "Select the existing Pages project."),
      option(
        "--project-name <name>",
        "Set the new, different Worker name: 1–63 ASCII letters, numbers, or hyphens; no edge hyphen.",
      ),
      option("--d1-name <name>", "Select the existing Pages D1 database."),
      option("--r2-name <name>", "Select the existing Pages R2 bucket."),
      option("--admin-path <path>", "Set the new Worker's dashboard path."),
      option("--admin-auth <built-in|none>", "Choose protection for the new Worker dashboard."),
      option("--owner-email <email>", "Set the new Worker administrator email."),
      option("--no-open", "Do not automatically open the one-time password page."),
      option("--yes", "Approve the described reuse and non-secret defaults non-interactively."),
    ],
    summary: "Create a side-by-side Worker migration from Cloudflare Pages.",
    usage: "yarn manage migrate-pages [--pages-name <name>] [--project-name <name>] [options]",
  },
  {
    changes: "Deploys the production Worker with a Cloudflare Custom Domain and updates local state.",
    details: [
      "Refuses preview environments and stops for manual Pages detachment when the hostname is still attached to the recorded Pages project.",
      "A pending password link is rotated to the final hostname after successful domain verification.",
    ],
    examples: [
      "yarn manage domain --instance personal --hostname feed.example.com",
    ],
    name: "domain",
    options: [
      option("--instance <name>", "Select the production site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--hostname <hostname>", "Set the exact custom hostname."),
      option("--yes", "Skip optional post-deployment prompts."),
    ],
    summary: "Configure and verify a production custom domain.",
    usage: "yarn manage domain [--instance <name>] [--hostname <hostname>]",
  },
  {
    changes: "Opens Cloudflare for a user-managed Access application; the CLI itself only guides and verifies.",
    details: [
      "Prints exact public-hostname and admin-path settings so Access protects only the dashboard while leaving public routes available.",
      "The user creates or edits the Access application in Cloudflare; optional verification checks both protected and public routes.",
    ],
    examples: [
      "yarn manage access --instance personal",
      "yarn manage access --preview --instance personal --open",
    ],
    name: "access",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Target the preview dashboard path."),
      option("--open", "Open the Cloudflare Access application page immediately."),
      option("--yes", "Print instructions without interactive opening or verification prompts."),
    ],
    summary: "Guide and verify optional Cloudflare Access protection.",
    usage: "yarn manage access [--instance <name>] [--preview] [--open]",
  },
  {
    changes: "Updates administrator credentials, configuration, D1 rows, and sometimes redeploys the Worker.",
    details: [
      "Actions: setup, reset-password, change-email, change-path, and disable. Without an action, the remote command presents a menu; a saved local-only instance is detected automatically, defaults to setup, and also supports reset-password and change-email.",
      "Cloudflare-connected instances target Cloudflare by default. Use --local only for their separate local development sandbox. Snapshot restore still needs --local because its target does not exist yet.",
      "Remote password setup/reset uses a browser link; local setup/reset uses hidden password and confirmation prompts. The raw --admin-password option is remote-only and intentionally unsafe.",
    ],
    examples: [
      "yarn manage auth setup --instance personal --owner-email me@example.com",
      "yarn manage auth reset-password --instance personal",
      "yarn manage auth change-email --instance personal --owner-email new@example.com",
      "yarn manage auth change-path --instance personal --admin-path dashboard",
      "yarn manage auth disable --instance personal",
      "yarn manage auth change-email --instance restored-local --owner-email new-owner@example.com",
      "yarn manage auth reset-password --instance restored-local",
    ],
    name: "auth",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Target the preview login."),
      option("--local", "Use a connected site's separate local development sandbox."),
      option("--owner-email <email>", "Supply the email for setup or change-email."),
      option("--admin-path <path>", "Set the new path for change-path."),
      option("--admin-password <value>", "Unsafe remote-only password for setup or reset-password."),
      option("--no-open", "Print the setup/reset link without opening it."),
      option("--yes", "Skip supported confirmation prompts, including the disable warning."),
    ],
    summary: "Set up or change the built-in dashboard login and path.",
    usage: "yarn manage auth [setup|reset-password|change-email|change-path|disable] [options]",
  },
  {
    changes: "Writes only the generated local Wrangler configuration when needed.",
    details: [
      "Validates saved instance state and regenerates the selected configuration without deploying or starting a server.",
    ],
    examples: [
      "yarn manage config --instance personal",
      "yarn manage config --preview --instance personal",
      "yarn manage config --local --instance personal",
    ],
    name: "config",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--preview", "Generate the preview configuration."),
      option("--local", "Require or create the local configuration view."),
    ],
    summary: "Validate saved state and generate a local Wrangler configuration.",
    usage: "yarn manage config [--instance <name>] [--preview|--local]",
  },
  {
    changes: "Reads local saved state and available Cloudflare Workers; does not change Cloudflare.",
    details: [
      "Groups local-only, connected, and discoverable Cloudflare installations by account and prints a ready-to-run connect command for unmanaged matches.",
      "Cloudflare discovery is skipped with guidance when Wrangler is not signed in.",
    ],
    examples: [
      "yarn manage instances",
      "yarn manage instances --account-id <id>",
    ],
    name: "instances",
    options: [
      option("--account-id <id>", "Limit Cloudflare discovery to one available account."),
    ],
    summary: "List local, managed, and connectable microfeed installations.",
    usage: "yarn manage instances [--account-id <id>]",
  },
  {
    changes: "Changes only the active-instance pointer in local repository state.",
    details: [
      "Selects the default site used when later commands omit --instance.",
    ],
    examples: [
      "yarn manage use personal",
      "yarn manage use --instance personal",
    ],
    name: "use",
    options: [
      option("--instance <name>", "Select the saved site; the positional name is preferred."),
    ],
    summary: "Select the default saved site.",
    usage: "yarn manage use <name>",
  },
] as const;

export function commandMetadata(
  name: string,
): CliCommandMetadata | undefined {
  return CLI_COMMANDS.find((command) => command.name === name);
}

function optionLines(options: readonly CliCommandOption[]): string[] {
  if (options.length === 0) {
    return [];
  }
  const width = Math.max(...options.map(({syntax}) => syntax.length));
  return [
    "Options:",
    ...options.map(({description, syntax}) =>
      `  ${syntax.padEnd(width)}  ${description}`
    ),
    `  ${"--help".padEnd(width)}  Show help for this command.`,
  ];
}

export function renderCliHelp(commandName?: string): string {
  if (commandName) {
    if (commandName === "setup") {
      throw new Error(
        "The top-level `setup` command was renamed. Use `yarn manage init`.",
      );
    }
    const command = commandMetadata(commandName);
    if (!command) {
      throw new Error(
        `Unknown management command: ${commandName}. Run \`yarn manage help\` ` +
          "to list available commands.",
      );
    }
    return [
      command.usage,
      "",
      command.summary,
      "",
      `Changes: ${command.changes}`,
      "",
      ...command.details,
      "",
      ...optionLines(command.options),
      "",
      "Examples:",
      ...command.examples.map((example) => `  ${example}`),
      "",
      "Complete reference: docs/manage-cli.md",
      "",
    ].join("\n");
  }

  const width = Math.max(...CLI_COMMANDS.map(({name}) => name.length));
  return [
    "microfeed management CLI",
    "",
    "Usage:",
    "  yarn manage <command> [options]",
    "  yarn manage help <command>",
    "",
    "Commands:",
    ...CLI_COMMANDS.map(({name, summary}) =>
      `  ${name.padEnd(width)}  ${summary}`
    ),
    "",
    "Use `yarn manage help <command>` or `yarn manage <command> --help` for details.",
    "Complete reference: docs/manage-cli.md",
    "",
  ].join("\n");
}
