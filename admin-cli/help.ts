export interface AdminCommandOption {
  description: string;
  syntax: string;
}

export interface AdminCommandMetadata {
  changes: string;
  details: string[];
  examples: string[];
  name: string;
  options: AdminCommandOption[];
  summary: string;
  usage: string;
}

const option = (
  syntax: string,
  description: string,
): AdminCommandOption => ({description, syntax});

export const ADMIN_COMMANDS: readonly AdminCommandMetadata[] = [
  {
    changes: "Read-only Cloudflare discovery; may update local OAuth credentials.",
    details: [
      "Checks the current Wrangler login and required permissions, opening browser authorization when needed.",
      "Returns the login identity, active profile, and every available Cloudflare account without changing account resources.",
    ],
    examples: [
      "yarn admin accounts",
      "yarn admin accounts --json",
      "yarn admin accounts --reauthorize",
    ],
    name: "accounts",
    options: [
      option("--json", "Print machine-readable identity and account data."),
      option("--reauthorize", "Force a fresh browser authorization."),
    ],
    summary: "Authorize Cloudflare and list available accounts.",
    usage: "yarn admin accounts [--json] [--reauthorize]",
  },
  {
    changes: "Creates or updates Cloudflare resources, or creates an isolated local sandbox with --local.",
    details: [
      "Production setup creates or reuses a Worker, D1 database, R2 bucket, secrets, migrations, and optional custom domain.",
      "Preview setup creates a separate Worker and D1 database while reusing production media storage.",
      "Built-in authentication normally prints a private browser link for setting the first password.",
    ],
    examples: [
      "yarn admin setup --instance personal",
      "yarn admin setup --preview --instance personal",
      "yarn admin setup --local --instance personal",
    ],
    name: "setup",
    options: [
      option("--instance <name>", "Select the saved site name."),
      option("--account-id <id>", "Use one exact Cloudflare account."),
      option("--project-name <name>", "Set the Worker name; for preview, set the preview Worker name."),
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
    summary: "Create or resume a production, preview, or local installation.",
    usage: "yarn admin setup [--instance <name>] [--preview|--local] [options]",
  },
  {
    changes: "Reads Cloudflare and writes local connection state; does not change Cloudflare.",
    details: [
      "Discovers compatible existing microfeed Workers, verifies public installation identity, and saves the selected deployment in this clone.",
      "Connected D1 and R2 resources are recorded as reused so later destruction will preserve them.",
    ],
    examples: [
      "yarn admin connect",
      "yarn admin connect --account-id <id> --worker existing-feed --instance personal",
    ],
    name: "connect",
    options: [
      option("--account-id <id>", "Search one exact Cloudflare account."),
      option("--worker <name>", "Select an exact compatible Worker."),
      option("--instance <name>", "Choose the local saved name for the connection."),
      option("--yes", "Run non-interactively; requires --worker when several matches exist."),
    ],
    summary: "Connect an existing Cloudflare microfeed to this clone.",
    usage: "yarn admin connect [--account-id <id>] [--worker <name>] [--instance <name>]",
  },
  {
    changes: "Updates the selected Cloudflare Worker and applies D1 migrations.",
    details: [
      "Runs type checks, tests, and a build before deploying, then verifies the public site and protected admin route.",
      "The yarn deploy alias invokes the reserved Cloudflare Workers Builds mode in CI.",
    ],
    examples: [
      "yarn admin deploy --instance personal",
      "yarn admin deploy --preview --instance personal",
    ],
    name: "deploy",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Deploy the saved preview environment."),
      option("--cloudflare-build", "Internal Workers Builds mode; rejected outside WORKERS_CI."),
    ],
    summary: "Check, migrate, deploy, and verify a saved installation.",
    usage: "yarn admin deploy [--instance <name>] [--preview]",
  },
  {
    changes: "Starts a local server and changes only isolated local D1/R2 simulation data.",
    details: [
      "Generates the selected local Wrangler configuration, applies local migrations, and starts Astro development.",
      "A connected Cloudflare installation still uses isolated local data; production D1 and R2 are never synchronized.",
    ],
    examples: [
      "yarn admin dev --instance personal",
      "yarn admin dev --preview --instance personal",
    ],
    name: "dev",
    options: [
      option("--instance <name>", "Select the local or connected site sandbox."),
      option("--preview", "Use the saved preview configuration with isolated local data."),
    ],
    summary: "Run one site locally with isolated development data.",
    usage: "yarn admin dev [--instance <name>] [--preview]",
  },
  {
    changes: "Read-only Cloudflare and public-site verification.",
    details: [
      "Checks the Worker, exact D1 identity, R2 bucket, public URL, administrator state, pending password link, and admin protection.",
      "Returns an actionable failure when a required resource or protection check is missing.",
    ],
    examples: [
      "yarn admin status --instance personal",
      "yarn admin status --preview --instance personal",
    ],
    name: "status",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Check the preview environment."),
    ],
    summary: "Verify Cloudflare resources, the public site, and admin protection.",
    usage: "yarn admin status [--instance <name>] [--preview]",
  },
  {
    changes: "Permanently deletes owned Cloudflare resources and local instance data unless explicitly preserved.",
    details: [
      "Always run --dry-run first. The plan includes exact identities, expected actions, and Cloudflare inspection links.",
      "The command refuses --yes, requires an exact typed or --confirm name, preserves reused resources, and resumes recorded partial deletion safely.",
      "Production cannot be destroyed while its preview still exists.",
    ],
    examples: [
      "yarn admin destroy --instance personal --dry-run",
      "yarn admin destroy --instance personal --confirm personal",
      "yarn admin destroy --instance personal --keep-data --confirm personal",
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
    usage: "yarn admin destroy --instance <name> [--preview] [--dry-run|--confirm <name>] [--keep-data]",
  },
  {
    changes: "Creates a side-by-side Worker and local state; reuses but does not modify or delete the Pages project, D1, or R2.",
    details: [
      "Discovers a Pages project and its existing D1/R2 resources, then deploys a differently named Worker for verification before manual traffic cutover.",
      "Preview mode is not supported because the migration Worker is already side by side.",
    ],
    examples: [
      "yarn admin migrate-pages",
      "yarn admin migrate-pages --pages-name legacy-feed --project-name legacy-feed-worker",
    ],
    name: "migrate-pages",
    options: [
      option("--account-id <id>", "Use one exact Cloudflare account."),
      option("--instance <name>", "Choose the new local saved site name."),
      option("--pages-name <name>", "Select the existing Pages project."),
      option("--project-name <name>", "Set the new, different Worker name."),
      option("--d1-name <name>", "Select the existing Pages D1 database."),
      option("--r2-name <name>", "Select the existing Pages R2 bucket."),
      option("--admin-path <path>", "Set the new Worker's admin path."),
      option("--admin-auth <built-in|none>", "Choose protection for the new Worker dashboard."),
      option("--owner-email <email>", "Set the new Worker administrator email."),
      option("--no-open", "Do not automatically open the one-time password page."),
      option("--yes", "Approve the described reuse and non-secret defaults non-interactively."),
    ],
    summary: "Create a side-by-side Worker migration from Cloudflare Pages.",
    usage: "yarn admin migrate-pages [--pages-name <name>] [--project-name <name>] [options]",
  },
  {
    changes: "Deploys the production Worker with a Cloudflare Custom Domain and updates local state.",
    details: [
      "Refuses preview environments and stops for manual Pages detachment when the hostname is still attached to the recorded Pages project.",
      "A pending password link is rotated to the final hostname after successful domain verification.",
    ],
    examples: [
      "yarn admin domain --instance personal --hostname feed.example.com",
    ],
    name: "domain",
    options: [
      option("--instance <name>", "Select the production site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--hostname <hostname>", "Set the exact custom hostname."),
      option("--yes", "Skip optional post-deployment prompts."),
    ],
    summary: "Configure and verify a production custom domain.",
    usage: "yarn admin domain [--instance <name>] [--hostname <hostname>]",
  },
  {
    changes: "Opens Cloudflare for a user-managed Access application; the CLI itself only guides and verifies.",
    details: [
      "Prints exact public-hostname and admin-path settings so Access protects only the dashboard while leaving public routes available.",
      "The user creates or edits the Access application in Cloudflare; optional verification checks both protected and public routes.",
    ],
    examples: [
      "yarn admin access --instance personal",
      "yarn admin access --preview --instance personal --open",
    ],
    name: "access",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Target the preview admin path."),
      option("--open", "Open the Cloudflare Access application page immediately."),
      option("--yes", "Print instructions without interactive opening or verification prompts."),
    ],
    summary: "Guide and verify optional Cloudflare Access protection.",
    usage: "yarn admin access [--instance <name>] [--preview] [--open]",
  },
  {
    changes: "Updates admin credentials, configuration, D1 rows, and sometimes redeploys the Worker.",
    details: [
      "Actions: setup, reset-password, change-email, change-path, and disable. Without an action, the remote command presents a menu; local defaults to setup.",
      "Browser password setup/reset is preferred. The raw --admin-password option is remote-only and intentionally unsafe.",
    ],
    examples: [
      "yarn admin auth setup --instance personal --owner-email me@example.com",
      "yarn admin auth reset-password --instance personal",
      "yarn admin auth change-email --instance personal --owner-email new@example.com",
      "yarn admin auth change-path --instance personal --admin-path dashboard",
      "yarn admin auth disable --instance personal",
    ],
    name: "auth",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--account-id <id>", "Confirm the exact saved Cloudflare account."),
      option("--preview", "Target the preview login."),
      option("--local", "Set up a local built-in login; other actions are remote-only."),
      option("--owner-email <email>", "Supply the email for setup or change-email."),
      option("--admin-path <path>", "Set the new path for change-path."),
      option("--admin-password <value>", "Unsafe remote-only password for setup or reset-password."),
      option("--no-open", "Print the setup/reset link without opening it."),
      option("--yes", "Skip supported confirmation prompts, including the disable warning."),
    ],
    summary: "Set up or change the built-in admin login and path.",
    usage: "yarn admin auth [setup|reset-password|change-email|change-path|disable] [options]",
  },
  {
    changes: "Writes only the generated local Wrangler configuration when needed.",
    details: [
      "Validates saved instance state and regenerates the selected configuration without deploying or starting a server.",
    ],
    examples: [
      "yarn admin config --instance personal",
      "yarn admin config --preview --instance personal",
      "yarn admin config --local --instance personal",
    ],
    name: "config",
    options: [
      option("--instance <name>", "Select the saved site."),
      option("--preview", "Generate the preview configuration."),
      option("--local", "Require or create the local configuration view."),
    ],
    summary: "Validate saved state and generate a local Wrangler configuration.",
    usage: "yarn admin config [--instance <name>] [--preview|--local]",
  },
  {
    changes: "Reads local saved state and available Cloudflare Workers; does not change Cloudflare.",
    details: [
      "Groups local-only, connected, and discoverable Cloudflare installations by account and prints a ready-to-run connect command for unmanaged matches.",
      "Cloudflare discovery is skipped with guidance when Wrangler is not signed in.",
    ],
    examples: [
      "yarn admin instances",
      "yarn admin instances --account-id <id>",
    ],
    name: "instances",
    options: [
      option("--account-id <id>", "Limit Cloudflare discovery to one available account."),
    ],
    summary: "List local, managed, and connectable microfeed installations.",
    usage: "yarn admin instances [--account-id <id>]",
  },
  {
    changes: "Changes only the active-instance pointer in local repository state.",
    details: [
      "Selects the default site used when later commands omit --instance.",
    ],
    examples: [
      "yarn admin use personal",
      "yarn admin use --instance personal",
    ],
    name: "use",
    options: [
      option("--instance <name>", "Select the saved site; the positional name is preferred."),
    ],
    summary: "Select the default saved site.",
    usage: "yarn admin use <name>",
  },
] as const;

export function commandMetadata(
  name: string,
): AdminCommandMetadata | undefined {
  return ADMIN_COMMANDS.find((command) => command.name === name);
}

function optionLines(options: readonly AdminCommandOption[]): string[] {
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

export function renderAdminHelp(commandName?: string): string {
  if (commandName) {
    const command = commandMetadata(commandName);
    if (!command) {
      throw new Error(
        `Unknown admin command: ${commandName}. Run \`yarn admin help\` ` +
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
      "Complete reference: docs/admin-cli.md",
      "",
    ].join("\n");
  }

  const width = Math.max(...ADMIN_COMMANDS.map(({name}) => name.length));
  return [
    "microfeed repository administration",
    "",
    "Usage:",
    "  yarn admin <command> [options]",
    "  yarn admin help <command>",
    "",
    "Commands:",
    ...ADMIN_COMMANDS.map(({name, summary}) =>
      `  ${name.padEnd(width)}  ${summary}`
    ),
    "",
    "Use `yarn admin help <command>` or `yarn admin <command> --help` for details.",
    "Complete reference: docs/admin-cli.md",
    "",
  ].join("\n");
}
