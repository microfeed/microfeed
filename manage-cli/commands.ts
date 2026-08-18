import {createReadStream, createWriteStream} from "node:fs";
import {createHash, randomBytes, randomUUID} from "node:crypto";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {Readable, Transform} from "node:stream";
import {pipeline} from "node:stream/promises";
import {setTimeout as delay} from "node:timers/promises";
import {isDeepStrictEqual} from "node:util";

import type {AdminAuthMode} from "@/shared/AdminAuth";
import {Miniflare} from "miniflare";
import DEFAULT_THEME_MANIFEST from "../themes/default/microfeed-theme.json";
import {
  adminBasePath,
  adminUrl,
  normalizeAdminPath,
  validateAdminPath,
} from "@/shared/AdminPath";
import {
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_SORT_ORDERS,
  PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES,
  STATUSES,
} from "@/shared/Constants";
import {ITEM_ORDERS, ITEM_SORTS} from "@/shared/ItemPagination";
import {DEFAULT_CHANNEL_COPYRIGHT} from "@/shared/TemplateVariables";
import {accessApplicationDashboardUrl} from "@/shared/CloudflareDashboard";
import type {Account, CommandRunner, MicrofeedConfig} from "./types";
import {
  clearPasswordSetupSql,
  type AuthOwner,
  type AuthPasswordSetup,
  normalizeOwnerEmail,
  ownerEmailUpdateSql,
  ownerInsertSql,
  passwordSetupSql,
  passwordResetSql,
  revokeOwnerOAuthSql,
  validateOwnerEmail,
  validateOwnerPassword,
} from "./lib/auth";
import {
  adminAuthMode,
  cloudflareAccountId,
  defaultLocalInstance,
  ensureLocalOnlyConfig,
  ensureWranglerConfig,
  generateWranglerConfig,
  instanceDirectory,
  instanceSummaries,
  isLocalOnly,
  isR2Ready,
  listLocalInstances,
  localPersistencePath,
  markStep,
  normalizeLocalInstanceName,
  readConfig,
  removeSavedInstance,
  setActiveInstance,
  validateLocalInstanceName,
  webhookEnabled,
  webhookProvisioned,
  webhookQueueName,
  webhookState,
  wranglerConfigPath,
  workersDevEnabled,
  workerName,
  writeConfig,
} from "./lib/config";
import {
  assertNoPagesCollision,
  type CloudflareIdentity,
  CloudflareClient,
  type DiscoveredMicrofeedWorker,
  isCloudflareAuthenticationError,
  pagesCollisionMessage,
  pagesDomainAttachedMessage,
  pagesDomainIsAttached,
  type QueueConsumer,
  R2NotEntitledError,
  validateWranglerProfileName,
} from "./lib/cloudflare";
import {
  openUrl,
  repositoryCommitSha,
  repositoryRoot,
  runCommand,
  runYarnScript,
} from "./lib/process";
import {verifyBundledThemeRelease} from "./lib/bundled-theme-release";
import {
  askConfirm,
  askPassword,
  askText,
  chooseAccount,
  chooseAdminAuthSetup,
  chooseLocalInstance,
  choosePagesProject,
  prompts,
  type WaitActivity,
  withSpinner,
} from "./lib/prompts";
import {renderCliHelp} from "./help";
import {
  applicationTablesFromSqlite,
  assertClassifiedTables,
  buildRestoreFinalizationSql,
  buildRestoreSql,
  createSnapshotArchive,
  extractSnapshotArchive,
  migrationIndexDefinitions,
  repositoryMigrations,
  type SnapshotIndexDefinition,
  type SnapshotManifest,
  type SnapshotMigration,
  type SnapshotR2Object,
  SNAPSHOT_FORMAT,
  SNAPSHOT_TABLES,
  SNAPSHOT_VERSION,
  sha256File,
  validateAppliedMigrationPrefix,
  validateSnapshotMigrations,
  writeSnapshotManifest,
} from "./lib/snapshot";
import {
  dropItemSearchIndexes,
  prepareItemSearch,
  setItemSearchReady,
  withItemSearchIndexesSuspended,
} from "./lib/item-search";

export type FlagValue = boolean | string;
export type Flags = Record<string, FlagValue>;

const WORKERS_DEV_REGISTRATION_ERROR =
  /(?:need to register a workers\.dev subdomain|workers\/onboarding)/iu;

export function workersDevInitializationError(
  error: unknown,
): Error | null {
  const detail = error instanceof Error ? error.message : String(error);
  if (!WORKERS_DEV_REGISTRATION_ERROR.test(detail)) {
    return null;
  }
  return new Error(
    "Cloudflare may still be preparing workers.dev for this account. This " +
      "sometimes happens when a Cloudflare account is newly created or is " +
      "deploying its first Worker. Wait a few minutes, then rerun the same " +
      "`yarn manage init` command. microfeed saved the completed steps and " +
      "will resume safely.",
  );
}

interface CommandContext {
  cloudflare: CloudflareClient;
  flags: Flags;
  instanceName?: string;
  pendingAdminEmail?: string;
  runner: CommandRunner;
}

function commandContext(
  contextOrFlags: CommandContext | Flags,
  runner: CommandRunner,
): CommandContext {
  if (
    typeof contextOrFlags.runner === "function" &&
    contextOrFlags.cloudflare instanceof CloudflareClient
  ) {
    return contextOrFlags as CommandContext;
  }
  return {
    cloudflare: new CloudflareClient(runner),
    flags: contextOrFlags as Flags,
    instanceName: undefined,
    runner,
  };
}

function flagString(flags: Flags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function flagBoolean(flags: Flags, name: string): boolean {
  return flags[name] === true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveCommandInstance(
  context: CommandContext,
  allowMissing = false,
): Promise<string | undefined> {
  if (context.instanceName) {
    return context.instanceName;
  }
  const requested = flagString(context.flags, "instance") ??
    process.env.MICROFEED_INSTANCE;
  if (requested) {
    const error = validateLocalInstanceName(requested);
    if (error) {
      throw new Error(`Invalid instance name \`${requested}\`. ${error}`);
    }
    context.instanceName = requested;
    return requested;
  }
  const selected = await defaultLocalInstance();
  if (selected) {
    context.instanceName = selected;
    return selected;
  }
  const instances = await listLocalInstances();
  if (instances.length > 1) {
    if (flagBoolean(context.flags, "yes")) {
      throw new Error(
        "Multiple local microfeed instances are configured. Pass " +
          "`--instance <name>` or run `yarn manage use <name>`.",
      );
    }
    context.instanceName = await chooseLocalInstance(instances);
    return context.instanceName;
  }
  if (allowMissing) {
    return undefined;
  }
  throw new Error(
    "No saved microfeed instance is configured. Run " +
      "`yarn manage init --local --instance <name>` for local development, " +
      "or `yarn manage init --instance <name>` for Cloudflare.",
  );
}

function instanceTargetMessage(config: MicrofeedConfig): string {
  const r2State = isR2Ready(config)
    ? "ready"
    : config.r2.setupMode === "disabled"
      ? "disabled"
      : "pending";
  return [
    `Instance: ${config.instanceName}`,
    `Worker: ${workerName(config)}`,
    `D1: ${config.d1.name}`,
    `R2: ${config.r2.name} (${r2State})`,
    ...(webhookProvisioned(config)
      ? [
          `Webhook Queue: ${config.webhooks!.queueName} ` +
            `(${webhookState(config)})`,
        ]
      : ["Webhooks: not provisioned (explicit opt-in required)"]),
    ...(config.customDomain ? [`Domain: ${config.customDomain}`] : []),
  ].join("\n");
}

export function validateWorkerName(name: string): string | undefined {
  if (name.length === 0 || name.length > 63) {
    return "Use 1–63 characters because microfeed is served on workers.dev.";
  }
  if (!/^[A-Za-z0-9-]+$/u.test(name)) {
    return "Use only ASCII letters, numbers, and hyphens; underscores and " +
      "spaces are not allowed.";
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return "The name cannot start or end with a hyphen.";
  }
  return undefined;
}

export function siteNameGuidance(): {message: string; title: string} {
  return {
    message:
      "Choose a globally unique, distinctive site name. If you plan to use " +
      "a custom address, replace its dots with hyphens—for example, " +
      "`my.domainname.com` becomes `my-domainname-com`.",
    title: "Choose a site name",
  };
}

function validateResourceName(name: string): string | undefined {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(name)) {
    return "Use lowercase letters, numbers, and hyphens (1–63 characters).";
  }
  return undefined;
}

function validateD1Name(name: string): string | undefined {
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/u.test(name)) {
    return "Use lowercase letters, numbers, hyphens, and underscores.";
  }
  return undefined;
}

function validateR2Name(name: string): string | undefined {
  const commonError = validateResourceName(name);
  if (commonError) {
    return commonError;
  }
  if (name.length < 3) {
    return "R2 bucket names must contain at least 3 characters.";
  }
  return undefined;
}

async function resourceName(
  flags: Flags,
  flag: string,
  message: string,
  defaultValue?: string,
): Promise<string> {
  const fromFlag = flagString(flags, flag);
  const value = fromFlag ?? await askText(message, defaultValue);
  const error = flag === "project-name"
    ? validateWorkerName(value)
    : flag === "d1-name"
      ? validateD1Name(value)
      : flag === "r2-name"
        ? validateR2Name(value)
        : validateResourceName(value);
  if (error) {
    const resource = flag === "project-name" ? "Worker name" : message;
    throw new Error(`Invalid ${resource} \`${value}\`. ${error}`);
  }
  return value;
}

async function configuredAdminPath(
  flags: Flags,
  defaultValue = "admin",
): Promise<string> {
  const value = flagString(flags, "admin-path") ??
    await askText("Dashboard path", defaultValue);
  const error = validateAdminPath(value);
  if (error) {
    throw new Error(error);
  }
  return normalizeAdminPath(value);
}

async function authenticate(
  context: CommandContext,
  requiredAccountId?: string,
): Promise<Account> {
  let accounts = await context.cloudflare.accounts();
  const hasRequiredScopes = accounts.length > 0 &&
    await context.cloudflare.hasRequiredScopes();
  if (accounts.length === 0 || !hasRequiredScopes) {
    prompts.note(
      "microfeed requests account:read, user:read, workers:write, " +
      "workers_scripts:write, d1:write, pages:write, and zone:read. " +
      "workers_scripts:write is required to safely check and deploy the " +
      "selected Worker name. pages:write is requested only because Wrangler " +
      "does not expose a pages:read OAuth scope. microfeed only lists Pages " +
      "projects and never changes or deletes them. Queue permission is " +
      "requested only when a command enables, disables, verifies, connects, " +
      "or destroys provisioned webhook infrastructure.",
      "Cloudflare authorization",
    );
    await context.cloudflare.login();
    accounts = await context.cloudflare.accounts();
  }
  if (accounts.length === 0) {
    throw new Error("Wrangler did not return any Cloudflare accounts.");
  }
  if (!await context.cloudflare.hasRequiredScopes()) {
    throw new Error(
      "Wrangler login did not grant all required microfeed OAuth scopes.",
    );
  }
  const flaggedAccountId = flagString(context.flags, "account-id");
  if (
    requiredAccountId &&
    flaggedAccountId &&
    flaggedAccountId !== requiredAccountId
  ) {
    throw new Error(
      `This microfeed is saved under Cloudflare account ${
        requiredAccountId
      }, not ${flaggedAccountId}. No Cloudflare resources were changed.`,
    );
  }
  const requestedAccountId = requiredAccountId ?? flaggedAccountId;
  if (requestedAccountId) {
    const account = accounts.find(({id}) => id === requestedAccountId);
    if (!account) {
      throw new Error(
        `Cloudflare account ${requestedAccountId} is not available to the ` +
          "current login. No Cloudflare resources were changed. Run " +
          "`yarn manage accounts --reauthorize`, then try again.",
      );
    }
    return account;
  }
  if (flagBoolean(context.flags, "yes") && accounts.length > 1) {
    throw new Error(
      "Multiple Cloudflare accounts are available. Run `yarn manage " +
        "accounts` and pass the chosen full ID as `--account-id <id>`. " +
        "No Cloudflare resources were changed.",
    );
  }
  return chooseAccount(accounts);
}

function cloudflareAuthorizationMessage(): string {
  return "microfeed requests account:read, user:read, workers:write, " +
    "workers_scripts:write, d1:write, pages:write, and zone:read. " +
    "workers_scripts:write is required to safely check and deploy the " +
    "selected site. pages:write is requested only because Wrangler does " +
    "not expose a pages:read OAuth scope. `yarn manage accounts` never " +
    "changes Cloudflare account resources. With `--profile`, it may create " +
    "local OAuth credentials and bind that Wrangler profile to this local " +
    "repository.";
}

export async function accountsCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const json = flagBoolean(flags, "json");
  if (flags.profile === true) {
    throw new Error(
      "`--profile` requires a name, for example `--profile company`. " +
        "No Cloudflare resources were changed.",
    );
  }
  const requestedProfile = flagString(flags, "profile");
  if (requestedProfile) {
    const profileError = validateWranglerProfileName(requestedProfile);
    if (profileError) {
      throw new Error(
        `Invalid Wrangler profile name \`${requestedProfile}\`. ` +
          `${profileError} No Cloudflare resources were changed.`,
      );
    }
  }
  const reauthorizeCommand = requestedProfile
    ? `yarn manage accounts --profile ${requestedProfile} --reauthorize`
    : "yarn manage accounts --reauthorize";
  const explainAuthorization = () => {
    if (json) {
      process.stderr.write(`\nCloudflare authorization\n${
        cloudflareAuthorizationMessage()
      }\n`);
    } else {
      prompts.note(
        cloudflareAuthorizationMessage(),
        "Cloudflare authorization",
      );
    }
  };

  const readIdentity = async (): Promise<{
    identity: CloudflareIdentity;
    scopesGranted: boolean;
  }> => {
    const identity = await context.cloudflare.identity();
    return {
      identity,
      scopesGranted: identity.accounts.length > 0 &&
        await context.cloudflare.hasRequiredScopes(),
    };
  };

  let identity: CloudflareIdentity;
  let scopesGranted: boolean;
  if (requestedProfile) {
    let authorizationPerformed = flagBoolean(flags, "reauthorize");
    if (!authorizationPerformed) {
      authorizationPerformed = !await context.cloudflare.profileExists(
        requestedProfile,
      );
    }
    if (authorizationPerformed) {
      explainAuthorization();
      await context.cloudflare.authorizeProfile(requestedProfile);
    }
    await context.cloudflare.activateProfile(requestedProfile);
    ({identity, scopesGranted} = await readIdentity());
    if (
      !authorizationPerformed &&
      (identity.accounts.length === 0 || !scopesGranted)
    ) {
      explainAuthorization();
      await context.cloudflare.authorizeProfile(requestedProfile);
      await context.cloudflare.activateProfile(requestedProfile);
      ({identity, scopesGranted} = await readIdentity());
    }
  } else if (flagBoolean(flags, "reauthorize")) {
    explainAuthorization();
    await context.cloudflare.login();
    ({identity, scopesGranted} = await readIdentity());
  } else {
    ({identity, scopesGranted} = await readIdentity());
    if (identity.accounts.length === 0 || !scopesGranted) {
      explainAuthorization();
      await context.cloudflare.login();
      ({identity, scopesGranted} = await readIdentity());
    }
  }

  if (identity.accounts.length === 0) {
    throw new Error(
      "Cloudflare did not return any accounts for this login. No " +
        "Cloudflare resources were changed. Use `" + reauthorizeCommand +
        "` to sign in with another Cloudflare user.",
    );
  }
  if (!scopesGranted) {
    throw new Error(
      "Cloudflare authorization did not grant all permissions microfeed " +
        "needs. No Cloudflare resources were changed. Run `" +
        reauthorizeCommand + "` and approve every requested permission.",
    );
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
    return;
  }
  const profiles = [...identity.profiles].sort((left, right) =>
    Number(right.active) - Number(left.active) ||
    Number(left.name === "default") - Number(right.name === "default") ||
    left.name.localeCompare(right.name)
  );
  const activeProfile = identity.profile ?? "the active profile";
  const accountNoun = identity.accounts.length === 1
    ? "Cloudflare account"
    : "Cloudflare accounts";
  prompts.intro("Cloudflare access for microfeed");
  prompts.log.info(
    "Saved Cloudflare logins (Wrangler profiles)\n" +
      "A profile is a Cloudflare login saved on this computer. This local " +
      "microfeed folder uses one profile at a time.\n\n" +
      (profiles.length > 0
        ? profiles.map(({active, name}) =>
            `  ${name} — ${
              active
                ? "active for this local microfeed folder"
                : name === "default"
                  ? "fallback login, not active"
                  : "saved, not active"
            }`
          ).join("\n")
        : "  none reported"),
  );
  prompts.log.info(
    "Active Cloudflare login\n" +
      `  Profile: ${activeProfile}\n` +
      `  Email: ${identity.email ?? "not reported"}`,
  );
  prompts.log.info(
    `${accountNoun} available through "${activeProfile}"\n` +
      "A Cloudflare account is a workspace that owns sites, databases, " +
      "and media storage.\n\n" +
      identity.accounts.map(({id, name}) => `  ${name} — ${id}`).join("\n"),
  );
  const switchableProfiles = profiles.filter(({active, name}) =>
    !active && name !== "default"
  );
  if (switchableProfiles.length > 0) {
    prompts.log.info(
      "Switch this local microfeed folder to another saved login\n" +
        switchableProfiles.map(({name}) =>
          `  yarn manage accounts --profile ${name}`
        ).join("\n"),
    );
  }
  prompts.outro(
    `The active "${activeProfile}" login can access ${
      identity.accounts.length
    } ${accountNoun}${
      identity.accounts.length === 1 ? "" : ". Account names may repeat; " +
        "use the full ID when choosing one"
    }. Inactive login profiles were listed but not queried.`,
  );
}

async function runChecks(
  runner: CommandRunner,
  config: MicrofeedConfig,
): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MICROFEED_INSTANCE: config.instanceName,
    MICROFEED_WRANGLER_CONFIG: wranglerConfigPath(config),
  };
  const execute = async (currentActivity: WaitActivity): Promise<void> => {
    currentActivity.update("Generating Worker binding types");
    await runYarnScript(runner, "types", {env});
    currentActivity.update("Checking TypeScript and Astro");
    await runYarnScript(runner, "typecheck", {env});
    currentActivity.update("Running deployment smoke tests");
    await runYarnScript(runner, "test:deploy", {env});
    currentActivity.update("Building the Worker");
    await runYarnScript(runner, "build", {env});
  };
  await withSpinner(
    {
      error: "Checks or build failed",
      start: "Preparing checks and build",
      success: "Checks and build passed",
    },
    execute,
  );
}

async function withEphemeralSecretFile<T>(
  includeBetterAuthSecret: boolean,
  includeUploadSigningKey: boolean,
  includeWebhookSecret: boolean,
  callback: (filename: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-secrets-"));
  const filename = path.join(directory, "secrets.json");
  try {
    await writeFile(
      filename,
      JSON.stringify({
        ...(includeBetterAuthSecret
          ? {BETTER_AUTH_SECRET: randomBytes(32).toString("base64url")}
          : {}),
        ...(includeUploadSigningKey
          ? {UPLOAD_SIGNING_KEY: randomBytes(32).toString("base64url")}
          : {}),
        ...(includeWebhookSecret
          ? {WEBHOOK_SECRET_KEY: randomBytes(32).toString("base64url")}
          : {}),
      }),
      {encoding: "utf8", mode: 0o600},
    );
    return await callback(filename);
  } finally {
    await unlink(filename).catch(() => undefined);
    await rmdir(directory).catch(() => undefined);
  }
}

async function withEphemeralSqlFile<T>(
  sql: string,
  callback: (filename: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-auth-"));
  const filename = path.join(directory, "auth.sql");
  try {
    await writeFile(filename, `${sql}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    return await callback(filename);
  } finally {
    await unlink(filename).catch(() => undefined);
    await rmdir(directory).catch(() => undefined);
  }
}

async function promptForPassword(
  message: string,
): Promise<string> {
  const password = await askPassword(message);
  const passwordError = validateOwnerPassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }
  const confirmation = await askPassword("Confirm password");
  if (password !== confirmation) {
    throw new Error("The passwords do not match.");
  }
  return password;
}

async function ensureAuthOwner(
  context: CommandContext,
  config: MicrofeedConfig,
  local = false,
): Promise<AuthOwner> {
  const existingOwner = await context.cloudflare.authOwner(config, local);
  if (existingOwner) {
    if (!local) {
      markStep(config, "auth-owner-created");
      await writeConfig(config);
    }
    return existingOwner;
  }
  if (flagBoolean(context.flags, "yes")) {
    throw new Error(
      "The first dashboard login requires an email and a hidden password prompt. " +
      "Run this command again without --yes.",
    );
  }
  prompts.note(
    "Create the account you will use to sign in to the microfeed admin " +
      "dashboard. The owner is the first administrator and has full control " +
      "of this microfeed. This email does not need to match your Cloudflare " +
      "account and is not shown publicly.",
    "Set up dashboard login",
  );
  const emailInput = flagString(context.flags, "owner-email") ??
    await askText("Dashboard login email");
  const emailError = validateOwnerEmail(emailInput);
  if (emailError) {
    throw new Error(emailError);
  }
  const email = normalizeOwnerEmail(emailInput);
  const password = await promptForPassword("Dashboard login password");
  const sql = await ownerInsertSql(email, password);
  await withEphemeralSqlFile(
    sql,
    (filename) => context.cloudflare.executeAuthSql(config, filename, local),
  );
  const owner = await context.cloudflare.authOwner(config, local);
  if (!owner) {
    throw new Error("The owner login was not created.");
  }
  if (!local) {
    markStep(config, "auth-owner-created");
    await writeConfig(config);
  }
  return owner;
}

function validateUnsafeAdminPasswordFlag(flags: Flags): void {
  if (flags["admin-password"] === true) {
    throw new Error("`--admin-password` requires a value.");
  }
  const password = flagString(flags, "admin-password");
  if (password === undefined) {
    return;
  }
  const error = validateOwnerPassword(password);
  if (error) {
    throw new Error(error);
  }
}

function unsafeAdminPassword(flags: Flags): string | undefined {
  validateUnsafeAdminPasswordFlag(flags);
  const password = flagString(flags, "admin-password");
  if (password === undefined) {
    return undefined;
  }
  prompts.log.warn(
    "Unsafe password option in use. Command arguments can be exposed in " +
      "shell history, process listings, agent transcripts, and CI logs. " +
      "The password will not be printed or saved by microfeed.",
  );
  return password;
}

async function adminEmailInput(
  context: CommandContext,
  defaultValue?: string,
): Promise<string> {
  prompts.note(
    "This is the email you will use to sign in to your microfeed dashboard. " +
      "It does not need to match your Cloudflare login and is not shown " +
      "publicly.",
    "Dashboard sign-in email",
  );
  const fromFlag = flagString(context.flags, "owner-email");
  if (!fromFlag && flagBoolean(context.flags, "yes")) {
    throw new Error(
      "Pass `--owner-email <email>` when using `--yes`. This is the email " +
        "used to sign in to the microfeed dashboard.",
    );
  }
  const emailInput = fromFlag ??
    await askText("Dashboard sign-in email", defaultValue);
  const emailError = validateOwnerEmail(emailInput);
  if (emailError) {
    throw new Error(emailError);
  }
  return normalizeOwnerEmail(emailInput);
}

async function prepareInitialAdminSetup(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (adminAuthMode(config) !== "built-in") {
    return;
  }
  const owner = await context.cloudflare.authOwner(config);
  if (owner) {
    context.pendingAdminEmail = undefined;
    markStep(config, "auth-owner-created");
    await writeConfig(config);
    return;
  }

  const email = context.pendingAdminEmail ?? await adminEmailInput(context);
  const password = unsafeAdminPassword(context.flags);
  if (password === undefined) {
    context.pendingAdminEmail = email;
    return;
  }

  const sql = `${await ownerInsertSql(email, password)}\n${
    clearPasswordSetupSql()
  }`;
  await withEphemeralSqlFile(
    sql,
    (filename) => context.cloudflare.executeAuthSql(config, filename),
  );
  const created = await context.cloudflare.authOwner(config);
  if (!created) {
    throw new Error("The dashboard login was not created.");
  }
  markStep(config, "auth-owner-created");
  await writeConfig(config);
}

async function collectInitialAdminSetupEmail(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (adminAuthMode(config) !== "built-in") {
    return;
  }
  const owner = await context.cloudflare.authOwner(config);
  if (!owner) {
    context.pendingAdminEmail ??= await adminEmailInput(context);
  }
}

async function issuePasswordSetupLink(
  context: CommandContext,
  config: MicrofeedConfig,
  input: {
    email: string;
    purpose: "initial" | "reset";
    userId: string | null;
  },
): Promise<string> {
  const baseUrl = deploymentVerificationUrl(config);
  if (!baseUrl) {
    throw new Error("Deploy microfeed before creating a password link.");
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1_000).toISOString();
  await withEphemeralSqlFile(
    passwordSetupSql({...input, expiresAt, tokenHash}),
    (filename) => context.cloudflare.executeAuthSql(config, filename),
  );
  const url = new URL(
    adminUrl(`login/${token}/set_password`, config.adminPath),
    baseUrl,
  ).href;
  prompts.note(
    `${url}\n\nThis private link expires in 30 minutes and can be used once. ` +
      "Creating another link immediately replaces it. Do not paste it into " +
      "chat or share it with anyone.",
    input.purpose === "initial"
      ? "Create your dashboard password"
      : "Reset your dashboard password",
  );
  if (
    !flagBoolean(context.flags, "no-open") &&
    !flagBoolean(context.flags, "yes")
  ) {
    try {
      await openUrl(context.runner, url);
    } catch (error) {
      prompts.log.warn(
        `The browser could not be opened automatically (${errorMessage(
          error,
        )}). Open the private link above yourself.`,
      );
    }
  }
  return url;
}

async function finishInitialAdminSetup(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (adminAuthMode(config) !== "built-in") {
    return;
  }
  const owner = await context.cloudflare.authOwner(config);
  if (owner) {
    prompts.note(
      `The dashboard login is ready for ${owner.email} at ${new URL(
        adminBasePath(config.adminPath),
        deploymentVerificationUrl(config)!,
      ).href}`,
      "Dashboard login ready",
    );
    return;
  }
  const pending = await context.cloudflare.authPasswordSetup(config);
  const email = context.pendingAdminEmail ?? pending?.email ??
    await adminEmailInput(context);
  await issuePasswordSetupLink(context, config, {
    email,
    purpose: "initial",
    userId: null,
  });
  prompts.log.info(
    `The dashboard at ${new URL(
      adminBasePath(config.adminPath),
      deploymentVerificationUrl(config)!,
    ).href} returns 403 until the password is created.`,
  );
}

const COMPLETED_CLOUDFLARE_INIT_STEPS = [
  "d1-ready",
  "worker-deployed",
  "deployment-verified",
] as const;

function hasCompletedCloudflareInitialization(
  config: MicrofeedConfig,
): boolean {
  return COMPLETED_CLOUDFLARE_INIT_STEPS.every((step) =>
    config.completedSteps.includes(step)
  );
}

function completedCloudflareInitializationMessage(
  config: MicrofeedConfig,
  preview: boolean,
): string {
  const instance = `--instance ${config.instanceName}`;
  const environment = preview ? "preview " : "";
  const previewFlag = preview ? " --preview" : "";
  return [
    `The ${environment}installation for \`${config.instanceName}\` is already initialized.`,
    `Use \`yarn manage deploy${previewFlag} ${instance}\` to publish a new release.`,
    `Use \`yarn manage status${previewFlag} ${instance}\` to verify it.`,
    ...(!preview
      ? [`Use \`yarn manage domain ${instance}\` to manage its web address.`]
      : []),
    `Use \`yarn manage auth${previewFlag} ${instance}\` to manage the dashboard login.`,
  ].join("\n");
}

async function resumePendingLoginOrStopInitialization(
  context: CommandContext,
  config: MicrofeedConfig,
  preview: boolean,
): Promise<boolean> {
  if (!hasCompletedCloudflareInitialization(config)) {
    return false;
  }
  if (adminAuthMode(config) === "built-in") {
    const owner = await context.cloudflare.authOwner(config);
    if (!owner) {
      await finishInitialAdminSetup(context, config);
      return true;
    }
  }
  throw new Error(completedCloudflareInitializationMessage(config, preview));
}

function completedLocalInitializationMessage(
  config: MicrofeedConfig,
): string {
  return [
    `The local installation for \`${config.instanceName}\` is already initialized.`,
    `Use \`yarn manage dev --instance ${config.instanceName}\` to run it.`,
    `Use \`yarn manage auth --instance ${config.instanceName}\` ` +
    "to manage the dashboard login.",
  ].join("\n");
}

async function markLocalInitializationComplete(
  config: MicrofeedConfig,
): Promise<void> {
  markStep(config, "initialization-complete");
  await writeConfig(config);
}

export const DEPLOYMENT_VERIFICATION_RETRY_DELAYS_MS = [
  5_000,
  10_000,
  20_000,
  40_000,
  80_000,
  160_000,
] as const;

const DEPLOYMENT_VERIFICATION_TIMEOUT_MS = 15_000;
const CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query";
const CURL_HTTP_STATUS_MARKER = "\n__MICROFEED_HTTP_STATUS__:";
const CURL_REDIRECT_URL_MARKER = "\n__MICROFEED_REDIRECT_URL__:";

interface DeploymentVerificationOptions {
  adminPath?: string;
  expectedAdminStatus?: number;
  runner?: CommandRunner;
  verifyAdminLogin?: boolean;
}

interface ErrorDetails {
  cause?: unknown;
  code?: unknown;
  hostname?: unknown;
  message?: unknown;
  name?: unknown;
}

interface VerificationHttpResult {
  body: string;
  location: string;
  status: number;
  usedDnsOverHttps: boolean;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorDetails(error: unknown): ErrorDetails[] {
  const chain: ErrorDetails[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (
    current !== null &&
    typeof current === "object" &&
    !seen.has(current) &&
    chain.length < 5
  ) {
    seen.add(current);
    const details = current as ErrorDetails;
    chain.push(details);
    current = details.cause;
  }
  return chain;
}

function isDnsLookupError(error: unknown): boolean {
  return errorDetails(error).some(
    ({code}) => code === "ENOTFOUND" || code === "EAI_AGAIN",
  );
}

function verificationErrorDetail(error: unknown, hostname: string): string {
  const chain = errorDetails(error);

  if (chain.some(({name}) => name === "AbortError")) {
    return `request timed out after ${
      DEPLOYMENT_VERIFICATION_TIMEOUT_MS / 1_000
    } seconds`;
  }

  const codedError = chain.find(({code}) => typeof code === "string");
  const code = typeof codedError?.code === "string"
    ? codedError.code
    : undefined;
  const errorHostname = typeof codedError?.hostname === "string"
    ? codedError.hostname
    : hostname;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `DNS lookup failed for ${errorHostname} (${code})`;
  }
  if (
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNREFUSED"
  ) {
    return `connection to ${errorHostname} failed (${code})`;
  }

  const messages = [...new Set(chain.flatMap(({message}) =>
    typeof message === "string" && message !== "fetch failed"
      ? [message]
      : []
  ))];
  if (code?.includes("CERT") || code?.startsWith("ERR_TLS_")) {
    return `TLS check failed for ${errorHostname} (${code})` +
      (messages.length > 0 ? `: ${messages.join(": ")}` : "");
  }
  if (messages.length > 0) {
    return messages.join(": ");
  }
  return error instanceof Error ? error.message : String(error);
}

async function curlWithCloudflareDns(
  runner: CommandRunner,
  url: URL,
): Promise<VerificationHttpResult | null> {
  const writeOut = `${CURL_HTTP_STATUS_MARKER}%{http_code}` +
    `${CURL_REDIRECT_URL_MARKER}%{redirect_url}`;
  let result;
  try {
    result = await runner(
      "curl",
      [
        "--silent",
        "--show-error",
        "--max-time",
        String(DEPLOYMENT_VERIFICATION_TIMEOUT_MS / 1_000),
        "--doh-url",
        CLOUDFLARE_DOH_URL,
        "--write-out",
        writeOut,
        url.href,
      ],
      {allowFailure: true},
    );
  } catch {
    return null;
  }
  if (result.exitCode !== 0) {
    return null;
  }
  const statusMarkerIndex = result.stdout.lastIndexOf(
    CURL_HTTP_STATUS_MARKER,
  );
  const redirectMarkerIndex = result.stdout.lastIndexOf(
    CURL_REDIRECT_URL_MARKER,
  );
  if (
    statusMarkerIndex < 0 ||
    redirectMarkerIndex <= statusMarkerIndex
  ) {
    return null;
  }
  const status = Number(
    result.stdout.slice(
      statusMarkerIndex + CURL_HTTP_STATUS_MARKER.length,
      redirectMarkerIndex,
    ),
  );
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return null;
  }
  return {
    body: result.stdout.slice(0, statusMarkerIndex),
    location: result.stdout.slice(
      redirectMarkerIndex + CURL_REDIRECT_URL_MARKER.length,
    ).trim(),
    status,
    usedDnsOverHttps: true,
  };
}

async function verificationHttpGet(
  url: URL,
  runner?: CommandRunner,
  signal?: AbortSignal,
  redirect: RequestRedirect = "follow",
): Promise<VerificationHttpResult> {
  try {
    const response = await fetch(url, {
      redirect,
      ...(signal ? {signal} : {}),
    });
    return {
      body: await response.text(),
      location: response.headers.get("location") ?? "",
      status: response.status,
      usedDnsOverHttps: false,
    };
  } catch (error) {
    if (!runner || !isDnsLookupError(error)) {
      throw error;
    }
    prompts.log.info(
      `System DNS cannot resolve ${url.hostname}; checking immediately ` +
        "through Cloudflare DNS over HTTPS.",
    );
    const result = await curlWithCloudflareDns(runner, url);
    if (!result) {
      throw error;
    }
    return result;
  }
}

interface VerifiedMicrofeedIdentity {
  instanceId: string;
  usedDnsOverHttps: boolean;
}

async function readMicrofeedIdentity(
  baseUrl: string,
  runner?: CommandRunner,
  signal?: AbortSignal,
): Promise<VerifiedMicrofeedIdentity> {
  const identityUrl = new URL("/.well-known/microfeed.json", baseUrl);
  const identityResponse = await verificationHttpGet(
    identityUrl,
    runner,
    signal,
  );
  if (
    identityResponse.status < 200 ||
    identityResponse.status >= 300
  ) {
    throw new Error(
      `microfeed identity check at ${identityUrl.href} returned ` +
        `HTTP ${identityResponse.status}.`,
    );
  }
  let data: {instanceId?: unknown; product?: unknown};
  try {
    data = JSON.parse(identityResponse.body) as typeof data;
  } catch {
    throw new Error(
      `microfeed identity check at ${identityUrl.href} returned invalid JSON.`,
    );
  }
  if (
    data.product !== "microfeed" ||
    typeof data.instanceId !== "string" ||
    data.instanceId.length === 0
  ) {
    throw new Error(
      `The endpoint at ${identityUrl.href} is not a microfeed installation.`,
    );
  }
  return {
    instanceId: data.instanceId,
    usedDnsOverHttps: identityResponse.usedDnsOverHttps,
  };
}

async function verifyDeploymentOnce(
  config: MicrofeedConfig | null,
  baseUrl: string,
  options: DeploymentVerificationOptions,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DEPLOYMENT_VERIFICATION_TIMEOUT_MS,
  );
  try {
    const identity = await readMicrofeedIdentity(
      baseUrl,
      options.runner,
      controller.signal,
    );
    if (
      config !== null &&
      identity.instanceId !== config.instanceId
    ) {
      throw new Error(
        "The deployed Worker does not match this microfeed installation.",
      );
    }
    const expectedAdminStatus = options.expectedAdminStatus ??
      (options.verifyAdminLogin ? 200 : null);
    if (expectedAdminStatus !== null) {
      const loginUrl = new URL(
        adminUrl("login", options.adminPath),
        baseUrl,
      );
      const loginResponse = await verificationHttpGet(
        loginUrl,
        options.runner,
        controller.signal,
        "manual",
      );
      if (loginResponse.status !== expectedAdminStatus) {
        throw new Error(
          `The dashboard login check at ${loginUrl.href} returned ` +
            `HTTP ${loginResponse.status}; expected ` +
            `HTTP ${expectedAdminStatus}.`,
        );
      }
    }
    return identity.usedDnsOverHttps;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyDeployment(
  config: MicrofeedConfig | null,
  baseUrl: string,
  options: DeploymentVerificationOptions = {},
): Promise<void> {
  const retryDelaysMs = DEPLOYMENT_VERIFICATION_RETRY_DELAYS_MS;
  const identityUrl = new URL("/.well-known/microfeed.json", baseUrl);
  let lastError: unknown;

  for (
    let attemptIndex = 0;
    attemptIndex <= retryDelaysMs.length;
    attemptIndex += 1
  ) {
    try {
      const usedDnsOverHttps = await verifyDeploymentOnce(
        config,
        baseUrl,
        options,
      );
      const retrySummary = attemptIndex > 0
        ? ` after ${attemptIndex} ${
          attemptIndex === 1 ? "retry" : "retries"
        }`
        : "";
      const dnsSummary = usedDnsOverHttps
        ? " using Cloudflare DNS over HTTPS because system DNS has not " +
          "caught up"
        : "";
      prompts.log.success(
        `✅ Deployment verified at ${identityUrl.href}${retrySummary}` +
          `${dnsSummary}.`,
      );
      return;
    } catch (error) {
      lastError = error;
      const detail = verificationErrorDetail(error, identityUrl.hostname);
      if (attemptIndex === retryDelaysMs.length) {
        break;
      }

      const delayMs = retryDelaysMs[attemptIndex]!;
      const delaySeconds = Math.round(delayMs / 1_000);
      prompts.log.warn(
        `Deployment verification attempt ${attemptIndex + 1} failed for ` +
          `${identityUrl.href}: ${detail}.`,
      );
      prompts.log.info(
        (
          config?.customDomain
            ? "Custom-domain DNS caches or TLS certificate provisioning " +
              "may still be catching up. "
            : "The deployment endpoint may still be becoming available. "
        ) +
          `Retrying in ${delaySeconds} seconds ` +
          `(retry ${attemptIndex + 1} of ${retryDelaysMs.length}).`,
      );
      await wait(delayMs);
    }
  }

  const totalWaitSeconds = Math.round(
    retryDelaysMs.reduce((total, delay) => total + delay, 0) / 1_000,
  );
  const attempts = retryDelaysMs.length + 1;
  const lastDetail = verificationErrorDetail(
    lastError,
    identityUrl.hostname,
  );
  const targetLabel = config?.customDomain
    ? "custom domain"
    : "deployment URL";
  const provisioningMessage = config?.customDomain
    ? "DNS resolution or Cloudflare TLS certificate provisioning may still " +
      "be catching up."
    : "The deployment endpoint may still be becoming available.";
  throw new Error(
    `The Worker was deployed, but its ${targetLabel} could not be verified ` +
      `after ${attempts} attempts over about ${totalWaitSeconds} seconds.\n` +
      `${provisioningMessage}\n` +
      `${config?.customDomain ? `Custom domain: ${baseUrl}\n` : ""}` +
      `Manual check: ${identityUrl.href}\n` +
      `Last error: ${lastDetail}`,
  );
}

export function deploymentVerificationUrl(
  config: MicrofeedConfig,
): string | null {
  return config.customDomain
    ? `https://${config.customDomain}`
    : config.deploymentUrl;
}

export function deploymentOutcomeMessage(
  config: MicrofeedConfig,
  preview = false,
): string {
  const publicUrl = deploymentVerificationUrl(config);
  if (!publicUrl) {
    throw new Error("The deployment completed without a public URL.");
  }
  return `${preview ? "Preview deployed" : "Deployed"} and verified ` +
    publicUrl;
}

export function workersAndPagesDashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    "workers-and-pages";
}

export function workerDashboardUrl(
  accountId: string,
  selectedWorkerName: string,
): string {
  return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    `workers/services/view/${encodeURIComponent(selectedWorkerName)}/` +
    "production/settings";
}

export function d1DashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    "workers/d1";
}

export function r2DashboardUrl(
  accountId: string,
  bucketName?: string,
): string {
  const root = `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    "r2/default/buckets";
  return bucketName ? `${root}/${encodeURIComponent(bucketName)}` : root;
}

export function r2OverviewDashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    "r2/overview";
}

export function queuesDashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${accountId}/workers/queues`;
}

export type AdminProtection = "access" | "built-in" | null;

interface AdminAuthDisableNotice {
  confirmation: string;
  message: string;
  title: string;
}

export function adminAuthDisableNotice(
  protection: AdminProtection,
  adminUrl: string,
): AdminAuthDisableNotice {
  const retainedLogin =
    "The existing account and credentials will be kept, so you can restore " +
    "the built-in login later with `yarn manage auth setup`.";
  if (protection === "access") {
    return {
      confirmation:
        "Disable the built-in login and rely on Cloudflare Access?",
      message:
        `Cloudflare Access (Zero Trust) currently protects ${adminUrl}. ` +
        "After this change, Access will be the only admin authentication " +
        `gate. ${retainedLogin}`,
      title: "✅ Cloudflare Access detected",
    };
  }
  return {
    confirmation:
      "Disable the built-in login and make the admin dashboard public?",
    message:
      `Cloudflare Access was not detected in front of ${adminUrl}. ` +
      "Disabling the built-in login will let anyone on the internet create, " +
      `edit, or delete content. ${retainedLogin}`,
    title: "Danger: admin dashboard will become public",
  };
}

export function localAdminAuthDisableNotice(
  adminUrl: string,
  instanceName: string,
): AdminAuthDisableNotice {
  return {
    confirmation: "Disable the built-in login for this local instance?",
    message:
      `The local dashboard at ${adminUrl} will open without a sign-in ` +
      "screen. Anyone who can reach the local development server can " +
      "create, edit, or delete content. The existing account and " +
      "credentials will be kept, so you can restore the built-in login " +
      `later with \`yarn manage auth setup --instance ${instanceName}\`.`,
    title: "Local dashboard login will be disabled",
  };
}

export function adminProtectionNotice(
  protection: AdminProtection,
  builtInAuthEnabled: boolean,
  adminUrl: string,
): {message: string; title: string} {
  if (protection === "access") {
    return {
      message: builtInAuthEnabled
        ? `Cloudflare Access (Zero Trust) protects ${adminUrl}, and the ` +
          "built-in login remains active behind it."
        : `Cloudflare Access (Zero Trust) protects ${adminUrl}. Anonymous ` +
          "visitors are redirected to Access, so the dashboard is not public.",
      title: "✅ Admin dashboard protected",
    };
  }
  if (protection === "built-in") {
    return {
      message: `The built-in dashboard login protects ${adminUrl}. Run ` +
        "`yarn manage access` if you also want Cloudflare Access as a " +
        "second gate.",
      title: "✅ Admin dashboard protected",
    };
  }
  return {
    message: builtInAuthEnabled
      ? `The built-in login is configured, but an anonymous request to ` +
        `${adminUrl} did not reach either its login page or Cloudflare ` +
        "Access. Run `yarn manage status` to investigate before using the " +
        "dashboard."
      : `The admin dashboard at ${adminUrl} is public. Run ` +
        "`yarn manage access` now, or add the built-in login with " +
        "`yarn manage auth setup`.",
    title: builtInAuthEnabled
      ? "Warning: dashboard protection could not be verified"
      : "Warning: admin dashboard is public",
  };
}

export function accessSetupInstructions(
  hostname: string,
  adminPath = "admin",
): string {
  const workersDevWarning = hostname.endsWith(".workers.dev")
    ? "\n\nImportant: choose Public hostname. Do not choose Worker and do not " +
      "use the workers.dev “Enable Cloudflare Access” button; those choices " +
      "would require a login for the entire public site."
    : "";
  return [
    "Create a Self-hosted Access application with these settings:",
    "",
    `• Application name: microfeed admin (${hostname})`,
    "• Destination type: Public hostname",
    `• Hostname: ${hostname}`,
    `• Path: ${adminPath}`,
    "• Login method: Cloudflare",
    "• Apply instant authentication: On",
    "• Policy action: Allow",
    "• Include: Cloudflare Account Member → current account",
    "",
    `The path \`${adminPath}\` protects /${adminPath}/, including every ` +
      "page below it. " +
      "Public pages, feeds, media, and API routes remain open.",
    "",
    "If Cloudflare is not listed as a login method, first add the Cloudflare " +
      "identity provider under Integrations → Identity providers and enable " +
      "Restrict to account members.",
  ].join("\n") + workersDevWarning;
}

async function configureAdminAuth(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (config.adminAuthMode) {
    return;
  }
  const requestedMode = flagString(context.flags, "admin-auth");
  if (
    requestedMode !== undefined &&
    requestedMode !== "built-in" &&
    requestedMode !== "none"
  ) {
    throw new Error(
      "`--admin-auth` must be either `built-in` or `none`.",
    );
  }
  const selectedMode = requestedMode ??
    (flagBoolean(context.flags, "yes")
      ? "built-in"
      : await chooseAdminAuthSetup());
  if (selectedMode === "none") {
    prompts.note(
      "Anyone on the internet will be able to open the admin dashboard and " +
        "create, edit, or delete content. Only continue if you understand " +
        "the risk and plan to protect the dashboard path with Cloudflare Zero " +
        "Trust Access.",
      "Danger: admin dashboard will be public",
    );
    if (
      !flagBoolean(context.flags, "yes") &&
      !await askConfirm(
        "Deploy without built-in admin authentication?",
        false,
      )
    ) {
      throw new Error(
        "Deployment cancelled. No authentication setting was changed.",
      );
    }
  }
  config.adminAuthMode = selectedMode;
  await writeConfig(config);
}

async function deployConfiguredProject(
  context: CommandContext,
  config: MicrofeedConfig,
  includeNewSigningSecret: boolean,
  initializeAdmin = false,
  initializeDefaultTheme = false,
): Promise<MicrofeedConfig> {
  await verifyBundledThemeRelease(repositoryRoot);
  const sourceCommitSha = await repositoryCommitSha(context.runner);
  await configureAdminAuth(context, config);
  await generateWranglerConfig(config);
  if (initializeAdmin) {
    await collectInitialAdminSetupEmail(context, config);
  }
  await context.cloudflare.applyMigrations(config);
  await prepareItemSearch(context.cloudflare, config);
  markStep(config, "migrations-applied");
  await writeConfig(config);
  if (initializeDefaultTheme) {
    const {installDefaultThemeForInitialization} = await import("./theme");
    await installDefaultThemeForInitialization(config, context.runner, false);
    markStep(config, "default-theme-installed");
    await writeConfig(config);
  } else {
    const {installDefaultThemeForV1Appearance} = await import("./theme");
    await installDefaultThemeForV1Appearance(config, context.runner, false);
  }
  if (initializeAdmin) {
    await prepareInitialAdminSetup(context, config);
  }
  await runChecks(context.runner, config);
  await setItemSearchReady(context.cloudflare, config, false);

  const needsAuthSecret = adminAuthMode(config) === "built-in" &&
    !config.completedSteps.includes("better-auth-secret-created");
  const needsUploadSigningSecret = includeNewSigningSecret &&
    !config.completedSteps.includes("upload-signing-secret-created") &&
    !config.completedSteps.includes("worker-deployed");
  const needsWebhookSecret = webhookProvisioned(config) &&
    !config.completedSteps.includes("webhook-secret-created");
  let deploymentUrl;
  try {
    deploymentUrl = needsAuthSecret || needsUploadSigningSecret || needsWebhookSecret
      ? await withEphemeralSecretFile(
          needsAuthSecret,
          needsUploadSigningSecret,
          needsWebhookSecret,
          (filename) => context.cloudflare.deploy(
            config,
            filename,
            sourceCommitSha,
          ),
        )
      : await context.cloudflare.deploy(config, undefined, sourceCommitSha);
  } catch (error) {
    try {
      await prepareItemSearch(context.cloudflare, config);
    } catch (recoveryError) {
      throw new Error(
        `${errorMessage(error)}\n\nThe deployment failed, and microfeed also ` +
          "could not restore search readiness after that failure. " +
          errorMessage(recoveryError),
      );
    }
    throw error;
  }
  config.deploymentUrl = deploymentUrl ?? config.deploymentUrl;
  if (needsAuthSecret) {
    markStep(config, "better-auth-secret-created");
  }
  if (needsUploadSigningSecret) {
    markStep(config, "upload-signing-secret-created");
  }
  if (needsWebhookSecret) {
    markStep(config, "webhook-secret-created");
  }
  markStep(config, "worker-deployed");
  await writeConfig(config);

  // A request handled by the previous Worker version can land after the
  // pre-deploy pass. Reconcile once the new writer is active before search is
  // considered ready.
  await prepareItemSearch(context.cloudflare, config);

  if (!config.deploymentUrl) {
    throw new Error(
      "Wrangler deployed successfully but did not report a workers.dev URL.",
    );
  }
  await verifyDeployment(config, deploymentVerificationUrl(config)!, {
    runner: context.runner,
  });
  markStep(config, "deployment-verified");
  await writeConfig(config);
  return config;
}

export async function redeployWithAdminAuthMode(
  config: MicrofeedConfig,
  nextMode: AdminAuthMode,
  operations: {
    deploy: (config: MicrofeedConfig) => Promise<void>;
    generate: (config: MicrofeedConfig) => Promise<void>;
    write: (config: MicrofeedConfig) => Promise<void>;
  },
): Promise<void> {
  await updateAdminAuthMode(config, nextMode, {
    apply: operations.deploy,
    generate: operations.generate,
    write: operations.write,
  });
}

async function updateAdminAuthMode(
  config: MicrofeedConfig,
  nextMode: AdminAuthMode,
  operations: {
    apply: (config: MicrofeedConfig) => Promise<void>;
    generate: (config: MicrofeedConfig) => Promise<void>;
    write: (config: MicrofeedConfig) => Promise<void>;
  },
): Promise<void> {
  const previous = structuredClone(config);
  config.adminAuthMode = nextMode;
  await operations.write(config);
  try {
    await operations.apply(config);
  } catch (error) {
    for (const key of Object.keys(config)) {
      Reflect.deleteProperty(config, key);
    }
    Object.assign(config, previous);
    await operations.write(config);
    await operations.generate(config);
    throw error;
  }
}

async function explicitReuse(
  flags: Flags,
  flag: "reuse-d1" | "reuse-r2",
  resource: string,
  resumed: boolean,
): Promise<boolean> {
  if (resumed || flagBoolean(flags, flag)) {
    return true;
  }
  if (flagBoolean(flags, "yes")) {
    throw new Error(
      `${resource} already exists. Pass --${flag} to reuse it explicitly.`,
    );
  }
  return askConfirm(`${resource} already exists. Reuse it?`, false);
}

function r2ActivationInstructions(
  accountId: string,
  instanceName: string,
): string {
  return [
    `Cloudflare R2 is not enabled for account ${accountId}.`,
    `Open ${r2OverviewDashboardUrl(accountId)}, activate R2, and complete ` +
      "Cloudflare's billing setup if requested.",
    "microfeed cannot accept billing terms or add a payment method for you.",
    "After activation, run " +
      `\`yarn manage deploy --enable-r2 --instance ${instanceName}\`.`,
  ].join(" ");
}

async function r2BucketAvailability(
  context: CommandContext,
  accountId: string,
  name: string,
): Promise<"available" | "exists" | "not-entitled"> {
  try {
    return await context.cloudflare.r2BucketExists(accountId, name)
      ? "exists"
      : "available";
  } catch (error) {
    if (error instanceof R2NotEntitledError) {
      return "not-entitled";
    }
    throw error;
  }
}

export function initializationResourceReuse(input: {
  exists: boolean;
  previouslyReused: boolean;
  resume: boolean;
  reuseApproved: boolean;
}): boolean {
  if (!input.exists) {
    return false;
  }
  return input.resume ? input.previouslyReused : input.reuseApproved;
}

export async function updateAndReloadInitializationConfig(
  expected: MicrofeedConfig,
  update: () => Promise<unknown>,
): Promise<MicrofeedConfig> {
  await update();
  const latest = await readConfig(false, expected.instanceName);
  if (!latest || latest.instanceId !== expected.instanceId) {
    throw new Error(
      `Initialization state for \`${expected.instanceName}\` changed ` +
        "unexpectedly. Stop and inspect the saved instance before retrying.",
    );
  }
  return latest;
}

async function initializeProduction(context: CommandContext): Promise<void> {
  const saved = await readConfig(false, context.instanceName);
  const noR2Requested = flagBoolean(context.flags, "no-r2");
  if (saved && isLocalOnly(saved)) {
    throw new Error(
      `Instance \`${saved.instanceName}\` is local only. Keep using it with ` +
        `\`yarn dev --instance ${saved.instanceName}\`, or choose a new ` +
        "instance name for the Cloudflare deployment.",
    );
  }
  if (saved && noR2Requested && isR2Ready(saved)) {
    throw new Error(
      `Instance \`${saved.instanceName}\` already has R2 bucket ` +
        `\`${saved.r2.name}\` configured. \`--no-r2\` never removes an ` +
        "existing media binding.",
    );
  }
  if (!saved && flagString(context.flags, "project-name") === undefined) {
    const guidance = siteNameGuidance();
    prompts.note(guidance.message, guidance.title);
  }
  const account = await authenticate(
    context,
    saved && !isLocalOnly(saved) ? cloudflareAccountId(saved) : undefined,
  );
  if (
    saved &&
    !isLocalOnly(saved) &&
    await resumePendingLoginOrStopInitialization(context, saved, false)
  ) {
    context.instanceName = saved.instanceName;
    return;
  }
  const projectDefault = flagString(context.flags, "project-name") ??
    process.env.CLOUDFLARE_PROJECT_NAME ??
    saved?.projectName ??
    context.instanceName;
  const projectName = await resourceName(
    context.flags,
    "project-name",
    "Site name",
    projectDefault,
  );
  if (saved && saved.projectName !== projectName) {
    throw new Error(
      `Instance \`${saved.instanceName}\` already manages ` +
        `Worker \`${workerName(saved)}\`. Create another instance with ` +
        `\`yarn manage init --instance ${normalizeLocalInstanceName(
          projectName,
        )}\`.`,
    );
  }
  const d1Name = await resourceName(
    context.flags,
    "d1-name",
    "D1 database name",
    saved?.projectName === projectName
      ? saved.d1.name
      : `${projectName}-db`,
  );
  const defaultR2Name = saved?.projectName === projectName
    ? saved.r2.name
    : `${projectName}-media`;
  const r2Name = noR2Requested
    ? flagString(context.flags, "r2-name") ?? defaultR2Name
    : await resourceName(
        context.flags,
        "r2-name",
        "R2 bucket name",
        defaultR2Name,
      );
  const r2NameError = validateR2Name(r2Name);
  if (r2NameError) {
    throw new Error(`Invalid R2 bucket name \`${r2Name}\`. ${r2NameError}`);
  }
  const adminPath = await configuredAdminPath(
    context.flags,
    saved?.projectName === projectName ? saved.adminPath : "admin",
  );
  prompts.note(
    [
      `Instance: ${context.instanceName ??
        normalizeLocalInstanceName(projectName)}`,
      `Worker: ${projectName}`,
      `D1: ${d1Name}`,
      `R2: ${r2Name}`,
    ].join("\n"),
    "Initialization target",
  );

  // Pages and Worker checks happen before any resource mutation.
  await assertNoPagesCollision(
    context.cloudflare,
    account.id,
    projectName,
  );
  const relatedSavedState = saved?.hosting === "cloudflare" &&
    saved.accountId === account.id &&
    saved.projectName === projectName;
  const workerExists = await context.cloudflare.workerExists(
    account.id,
    projectName,
  );
  if (workerExists && !relatedSavedState) {
    const localInstanceName = context.instanceName ??
      normalizeLocalInstanceName(projectName);
    throw new Error(
      `A Worker named \`${projectName}\` already exists, but this clone has ` +
      "no saved state for it. microfeed will not overwrite it. If it is an " +
      "existing microfeed installation, connect it with " +
      `\`yarn manage connect --worker ${projectName} --instance ` +
      `${localInstanceName}\`. Otherwise, choose a different project name.`,
    );
  }

  const skipR2Setup = noR2Requested || saved?.r2.setupMode === "disabled";
  const [databases, r2Availability] = await Promise.all([
    context.cloudflare.d1Databases(account.id),
    saved?.completedSteps.includes("r2-ready")
      ? Promise.resolve("exists" as const)
      : skipR2Setup
      ? Promise.resolve("skipped" as const)
      : r2BucketAvailability(context, account.id, r2Name),
  ]);
  const r2Exists = r2Availability === "exists";
  let r2Pending = r2Availability === "not-entitled";
  const existingD1 = databases.find(({name}) => name === d1Name);
  const d1Resumed = Boolean(
    relatedSavedState &&
    saved.completedSteps.includes("d1-ready") &&
    saved.d1.name === d1Name,
  );
  const useExistingD1 = existingD1
    ? await explicitReuse(
        context.flags,
        "reuse-d1",
        `D1 database \`${d1Name}\``,
        d1Resumed,
      )
    : false;
  if (existingD1 && !useExistingD1) {
    throw new Error(
      "Initialization stopped before changing any Cloudflare resources.",
    );
  }
  const reuseD1 = initializationResourceReuse({
    exists: Boolean(existingD1),
    previouslyReused: saved?.d1.reuse ?? false,
    resume: d1Resumed,
    reuseApproved: useExistingD1,
  });

  const r2Resumed = Boolean(
    !skipR2Setup &&
    !r2Pending &&
    relatedSavedState &&
    saved.completedSteps.includes("r2-ready") &&
    saved.r2.name === r2Name,
  );
  const useExistingR2 = r2Exists
    ? await explicitReuse(
        context.flags,
        "reuse-r2",
        `R2 bucket \`${r2Name}\``,
        r2Resumed,
      )
    : false;
  if (r2Exists && !useExistingR2) {
    throw new Error(
      "Initialization stopped before changing any Cloudflare resources.",
    );
  }
  const reuseR2 = initializationResourceReuse({
    exists: r2Exists,
    previouslyReused: saved?.r2.reuse ?? false,
    resume: r2Resumed,
    reuseApproved: useExistingR2,
  });

  let config: MicrofeedConfig = relatedSavedState && saved
    ? saved
    : {
        accountId: account.id,
        adminPath,
        completedSteps: [],
        customDomain: null,
        d1: {id: "", name: d1Name, reuse: reuseD1},
        deploymentUrl: null,
        hosting: "cloudflare",
        instanceId: randomUUID(),
        instanceName: context.instanceName ??
          normalizeLocalInstanceName(projectName),
        projectName,
        r2: {
          name: r2Name,
          reuse: reuseR2,
          setupMode: skipR2Setup ? "disabled" : "automatic",
        },
      };
  context.instanceName = config.instanceName;
  config.adminPath = adminPath;
  config.d1.name = d1Name;
  config.d1.reuse = reuseD1;
  config.r2.name = r2Name;
  config.r2.reuse = reuseR2;
  config.r2.setupMode = skipR2Setup ? "disabled" : "automatic";
  await setActiveInstance(context.instanceName);
  await writeConfig(config);
  await configureAdminAuth(context, config);

  if (existingD1) {
    config.d1.id = existingD1.id;
  } else {
    prompts.log.step(`Creating D1 database ${d1Name}`);
    config.d1.id = await context.cloudflare.createD1(account.id, d1Name);
  }
  markStep(config, "d1-ready");
  await writeConfig(config);

  if (!skipR2Setup && !r2Pending && !r2Exists) {
    prompts.log.step(`Creating R2 bucket ${r2Name}`);
    try {
      await context.cloudflare.createR2(account.id, r2Name);
    } catch (error) {
      if (error instanceof R2NotEntitledError) {
        r2Pending = true;
      } else {
        throw error;
      }
    }
  }
  if (!skipR2Setup && !r2Pending) {
    markStep(config, "r2-ready");
    await writeConfig(config);
  } else if (r2Pending) {
    prompts.note(
      r2ActivationInstructions(account.id, config.instanceName),
      "Media uploads will be enabled later",
    );
  } else {
    prompts.log.info(
      "R2 media storage was disabled. Text publishing and external media " +
        "URLs remain available.",
    );
  }

  await deployConfiguredProject(context, config, true, true, true);
  if (isR2Ready(config)) {
    await verifyR2Deployment(context, config);
  }
  prompts.log.success(`microfeed is live at ${config.deploymentUrl}`);

  if (!flagBoolean(context.flags, "yes")) {
    if (adminAuthMode(config) !== "built-in") {
      prompts.note(
        `The admin dashboard at ${new URL(
          adminBasePath(config.adminPath),
          config.deploymentUrl!,
        ).href} is public. Protect it now with ` +
        "`yarn manage access`, or add the built-in login later with " +
        "`yarn manage auth setup`.",
        "Warning: admin authentication skipped",
      );
    }
    if (await askConfirm("Configure a custom domain now?", true)) {
      config = await updateAndReloadInitializationConfig(
        config,
        () => domainCommand(context),
      );
    } else {
      prompts.note(
        "Your workers.dev address remains available. Add a custom domain " +
        "at any time with `yarn manage domain`.",
        "Custom domain skipped",
      );
    }
  }
  await finishInitialAdminSetup(context, config);
  if (isR2Ready(config)) {
    try {
      await recordRemoteRestoreBaseline(context, config);
    } catch (error) {
      config.completedSteps = config.completedSteps.filter(
        (step) => step !== "deployment-verified",
      );
      await writeConfig(config);
      throw error;
    }
  }
}

async function initializePreview(context: CommandContext): Promise<void> {
  const production = await readConfig(false, context.instanceName);
  if (!production) {
    throw new Error(
      "Set up the production environment first with " +
      "`yarn manage init`, then run `yarn manage init --preview`.",
    );
  }
  if (isLocalOnly(production)) {
    throw new Error(
      `Instance \`${production.instanceName}\` is local only and cannot ` +
        "have a Cloudflare preview environment. Select a managed Cloudflare " +
        "instance first.",
    );
  }
  if (!isR2Ready(production)) {
    throw new Error(
      `Preview initialization requires production R2 media storage. Run ` +
        `\`yarn manage deploy --enable-r2 --instance ${production.instanceName}\` ` +
        "first, then retry `yarn manage init --preview`.",
    );
  }
  const productionAccountId = cloudflareAccountId(production);
  const account = await authenticate(context, productionAccountId);
  if (account.id !== productionAccountId) {
    throw new Error(
      `This installation belongs to Cloudflare account ${productionAccountId}.`,
    );
  }

  const saved = await readConfig(true, context.instanceName);
  const savedForProduction = saved?.accountId === account.id &&
      saved.projectName === production.projectName
    ? saved
    : null;
  if (
    savedForProduction &&
    await resumePendingLoginOrStopInitialization(
      context,
      savedForProduction,
      true,
    )
  ) {
    return;
  }
  const productionWorkerName = workerName(production);
  const previewWorkerName = await resourceName(
    context.flags,
    "project-name",
    "Preview Worker project name",
    savedForProduction?.workerName ?? `${productionWorkerName}-preview`,
  );
  if (previewWorkerName === productionWorkerName) {
    throw new Error(
      "The preview Worker name must differ from the production Worker name.",
    );
  }
  const savedForWorker = savedForProduction &&
      workerName(savedForProduction) === previewWorkerName
    ? savedForProduction
    : null;
  const d1Name = await resourceName(
    context.flags,
    "d1-name",
    "Preview D1 database name",
    savedForWorker?.d1.name ?? `${previewWorkerName}-db`,
  );
  const adminPath = await configuredAdminPath(
    context.flags,
    savedForWorker?.adminPath ?? production.adminPath,
  );

  await assertNoPagesCollision(
    context.cloudflare,
    account.id,
    previewWorkerName,
  );
  const relatedSavedState = savedForWorker !== null;
  const existingWorker = await context.cloudflare.workerExists(
    account.id,
    previewWorkerName,
  );
  if (existingWorker && !relatedSavedState) {
    throw new Error(
      `A Worker named \`${previewWorkerName}\` already exists. microfeed ` +
      "will not overwrite an unrelated Worker. Choose a different name.",
    );
  }

  const [databases, r2Exists] = await Promise.all([
    context.cloudflare.d1Databases(account.id),
    context.cloudflare.r2BucketExists(account.id, production.r2.name),
  ]);
  if (!r2Exists) {
    throw new Error(
      `The production R2 bucket \`${production.r2.name}\` was not found. ` +
      "Preview initialization stopped before changing any Cloudflare resources.",
    );
  }
  const existingD1 = databases.find(({name}) => name === d1Name);
  const d1Resumed = Boolean(
    relatedSavedState &&
    savedForWorker?.completedSteps.includes("d1-ready") &&
    savedForWorker.d1.name === d1Name,
  );
  const useExistingD1 = existingD1
    ? await explicitReuse(
        context.flags,
        "reuse-d1",
        `D1 database \`${d1Name}\``,
        d1Resumed,
      )
    : false;
  if (existingD1 && !useExistingD1) {
    throw new Error(
      "Preview initialization stopped before changing any Cloudflare resources.",
    );
  }
  const reuseD1 = initializationResourceReuse({
    exists: Boolean(existingD1),
    previouslyReused: savedForWorker?.d1.reuse ?? false,
    resume: d1Resumed,
    reuseApproved: useExistingD1,
  });

  const config: MicrofeedConfig = relatedSavedState && savedForWorker
    ? savedForWorker
    : {
        accountId: account.id,
        adminPath,
        completedSteps: ["r2-ready"],
        customDomain: null,
        deploymentEnvironment: "preview",
        d1: {id: "", name: d1Name, reuse: reuseD1},
        deploymentUrl: null,
        hosting: "cloudflare",
        instanceId: randomUUID(),
        instanceName: production.instanceName,
        projectName: production.projectName,
        r2: {
          name: production.r2.name,
          reuse: true,
          setupMode: "automatic",
        },
        workerName: previewWorkerName,
      };
  config.adminPath = adminPath;
  config.d1.name = d1Name;
  config.d1.reuse = reuseD1;
  config.r2 = {
    name: production.r2.name,
    reuse: true,
    setupMode: "automatic",
  };
  config.workerName = previewWorkerName;
  await writeConfig(config);
  await configureAdminAuth(context, config);

  if (existingD1) {
    config.d1.id = existingD1.id;
  } else {
    prompts.log.step(`Creating preview D1 database ${d1Name}`);
    config.d1.id = await context.cloudflare.createD1(account.id, d1Name);
  }
  markStep(config, "d1-ready");
  await writeConfig(config);

  await deployConfiguredProject(context, config, true, true, true);
  prompts.log.success(
    `microfeed preview is live at ${config.deploymentUrl}`,
  );

  await finishInitialAdminSetup(context, config);

  if (!flagBoolean(context.flags, "yes")) {
    prompts.note(
      adminAuthMode(config) === "built-in"
        ? `The preview dashboard uses its own sign-in at ` +
          `${new URL(
            adminBasePath(config.adminPath),
            config.deploymentUrl!,
          ).href}. If its password is not set yet, that address stays ` +
          "locked with HTTP 403."
        : `The preview dashboard at ${new URL(
            adminBasePath(config.adminPath),
            config.deploymentUrl!,
          ).href} is public. Run \`yarn manage access --preview\` to ` +
          "protect it.",
      adminAuthMode(config) === "built-in"
        ? "Preview dashboard login ready"
        : "Warning: preview authentication skipped",
    );
  }
}

async function localInitInstanceName(flags: Flags): Promise<string> {
  const requested = flagString(flags, "instance") ??
    process.env.MICROFEED_INSTANCE;
  if (requested) {
    const error = validateLocalInstanceName(requested);
    if (error) {
      throw new Error(`Invalid instance name \`${requested}\`. ${error}`);
    }
    return requested;
  }
  const activeName = await defaultLocalInstance();
  if (activeName) {
    const activeConfig = await readConfig(false, activeName);
    if (activeConfig && isLocalOnly(activeConfig)) {
      return activeName;
    }
  }
  return "local";
}

export function localAdminAuthSetupNotice(instanceName: string): {
  confirmation: string;
  message: string;
  title: string;
} {
  return {
    confirmation: "Set up an administrator email and password now?",
    message:
      "Built-in email and password authentication is optional for local " +
      "development. Set it up now to try the production sign-in flow, " +
      "or add it later with " +
      `\`yarn manage auth setup --instance ${instanceName}\`.\n\n` +
      "For production, we strongly recommend protecting `/admin/` with " +
      "the built-in login, Cloudflare Zero Trust Access, or both.",
    title: "Optional local dashboard login",
  };
}

async function initializeLocal(context: CommandContext): Promise<void> {
  const targetName = await localInitInstanceName(context.flags);
  context.instanceName = targetName;
  const existingConfig = await readConfig(false, targetName);
  const noR2Requested = flagBoolean(context.flags, "no-r2");
  if (existingConfig && noR2Requested && isR2Ready(existingConfig)) {
    throw new Error(
      `Instance \`${targetName}\` already has simulated R2 storage ` +
        "configured. `--no-r2` never removes an existing media binding.",
    );
  }
  if (existingConfig?.completedSteps.includes("initialization-complete")) {
    throw new Error(completedLocalInitializationMessage(existingConfig));
  }
  const config = await ensureLocalOnlyConfig(targetName);
  const requestedR2Name = flagString(context.flags, "r2-name");
  if (requestedR2Name) {
    const error = validateR2Name(requestedR2Name);
    if (error) {
      throw new Error(
        `Invalid R2 bucket name \`${requestedR2Name}\`. ${error}`,
      );
    }
    if (existingConfig && requestedR2Name !== config.r2.name) {
      throw new Error(
        `Instance \`${targetName}\` already uses media name ` +
          `\`${config.r2.name}\`. Choose another instance name to use ` +
          `\`${requestedR2Name}\`.`,
      );
    }
    config.r2.name = requestedR2Name;
  }
  if (!existingConfig && noR2Requested) {
    config.r2.setupMode = "disabled";
    config.completedSteps = config.completedSteps.filter(
      (step) => step !== "r2-ready",
    );
    await writeConfig(config);
    await generateWranglerConfig(config);
  }
  await setActiveInstance(targetName);
  prompts.note(
    [
      `Instance: ${targetName}`,
      "Type: Local only",
      `D1: ${config.d1.name} (local simulation)`,
      `R2: ${config.r2.name} (${isR2Ready(config)
        ? "local simulation"
        : "disabled"})`,
      "Cloudflare resources: none",
    ].join("\n"),
    "Local initialization target",
  );
  await context.cloudflare.applyLocalMigrations(config);
  await prepareItemSearch(context.cloudflare, config, {
    local: true,
    persistTo: localPersistencePath(config),
  });
  const {installDefaultThemeForInitialization} = await import("./theme");
  await installDefaultThemeForInitialization(config, context.runner, true);
  markStep(config, "default-theme-installed");
  await writeConfig(config);

  const requestedMode = flagString(context.flags, "admin-auth");
  if (
    requestedMode !== undefined &&
    requestedMode !== "built-in" &&
    requestedMode !== "none"
  ) {
    throw new Error(
      "`--admin-auth` must be either `built-in` or `none`.",
    );
  }
  const existingOwner = await context.cloudflare.authOwner(config, true);
  const resumedWithoutBuiltInAuth = Boolean(existingConfig) &&
    adminAuthMode(config) === "none" &&
    requestedMode === undefined;
  if (resumedWithoutBuiltInAuth) {
    prompts.log.info(
      "Built-in dashboard login remains disabled for this local instance. " +
        `Add it with \`yarn manage auth setup --instance ${targetName}\`.`,
    );
    await markLocalInitializationComplete(config);
    return;
  }
  if (
    existingOwner &&
    adminAuthMode(config) === "built-in" &&
    requestedMode !== "none"
  ) {
    prompts.log.success(`Local dashboard login ready for ${existingOwner.email}.`);
    await markLocalInitializationComplete(config);
    return;
  }

  let shouldSetUpBuiltInAuth: boolean;
  if (requestedMode !== undefined) {
    shouldSetUpBuiltInAuth = requestedMode === "built-in";
  } else if (flagBoolean(context.flags, "yes")) {
    shouldSetUpBuiltInAuth = true;
  } else {
    const notice = localAdminAuthSetupNotice(targetName);
    prompts.note(notice.message, notice.title);
    shouldSetUpBuiltInAuth = await askConfirm(
      notice.confirmation,
      false,
    );
  }
  if (!shouldSetUpBuiltInAuth) {
    config.adminAuthMode = "none";
    await writeConfig(config);
    await generateWranglerConfig(config);
    prompts.note(
      "The local admin dashboard will open without a sign-in screen. Add " +
        "the built-in login later with " +
        `\`yarn manage auth setup --instance ${targetName}\`.`,
      "Built-in dashboard login skipped",
    );
    await markLocalInitializationComplete(config);
    return;
  }

  const owner = await ensureAuthOwner(context, config, true);
  if (adminAuthMode(config) === "none") {
    config.adminAuthMode = "built-in";
    await writeConfig(config);
    await generateWranglerConfig(config);
  }
  prompts.log.success(`Local dashboard login ready for ${owner.email}.`);
  await markLocalInitializationComplete(config);
}

export async function initCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const preview = flagBoolean(flags, "preview");
  const local = flagBoolean(flags, "local");
  const noR2 = flagBoolean(flags, "no-r2");
  const suppliedProjectName = flagString(flags, "project-name");
  if (!local && suppliedProjectName !== undefined) {
    const error = validateWorkerName(suppliedProjectName);
    if (error) {
      throw new Error(
        `Invalid Worker name \`${suppliedProjectName}\`. ${error} ` +
          "No Cloudflare authorization was attempted and no resources " +
          "were changed.",
      );
    }
  }
  if (local && preview) {
    throw new Error(
      "`--local` and `--preview` cannot be used together. Local instances " +
        "already use isolated development data.",
    );
  }
  if (noR2 && preview) {
    throw new Error(
      "`--no-r2` and `--preview` cannot be used together. Preview " +
        "environments require production media storage.",
    );
  }
  if (noR2 && flagBoolean(flags, "reuse-r2")) {
    throw new Error(
      "`--no-r2` and `--reuse-r2` cannot be used together because no R2 " +
        "bucket is inspected or bound.",
    );
  }
  const suppliedEmail = flagString(flags, "owner-email");
  if (suppliedEmail) {
    const error = validateOwnerEmail(suppliedEmail);
    if (error) {
      throw new Error(error);
    }
  }
  if (local && flags["admin-password"] !== undefined) {
    throw new Error(
      "`--admin-password` is not supported for local instances. Run the " +
        "local initialization interactively so the password stays hidden.",
    );
  }
  if (
    flags["admin-password"] !== undefined &&
    flagString(flags, "admin-auth") === "none"
  ) {
    throw new Error(
      "`--admin-password` cannot be used when built-in authentication is " +
        "disabled.",
    );
  }
  validateUnsafeAdminPasswordFlag(flags);
  if (!local) {
    await resolveCommandInstance(context, !preview);
  }
  prompts.intro(
    local
      ? "microfeed local initialization"
      : preview
      ? "microfeed preview initialization"
      : "microfeed deployment initialization",
  );
  try {
    if (local) {
      await initializeLocal(context);
    } else if (preview) {
      await initializePreview(context);
    } else {
      await initializeProduction(context);
    }
  } catch (error) {
    const workersDevError = local
      ? null
      : workersDevInitializationError(error);
    throw workersDevError ?? error;
  }
  prompts.outro(
    local
      ? `Local initialization complete. Start it with \`yarn dev --instance ${
        context.instanceName ?? "local"
      }\`.`
      : preview
      ? "Preview initialization complete. Update it with " +
        "`yarn manage deploy --preview`."
      : "Initialization complete. Future releases use `yarn manage deploy`.",
  );
}

export async function prepareR2ForDeployment(
  context: CommandContext,
  config: MicrofeedConfig,
  explicitlyEnabled: boolean,
): Promise<boolean> {
  if (isR2Ready(config)) {
    return false;
  }
  if (config.r2.setupMode === "disabled" && !explicitlyEnabled) {
    return false;
  }

  const accountId = cloudflareAccountId(config);
  const availability = await r2BucketAvailability(
    context,
    accountId,
    config.r2.name,
  );
  if (availability === "not-entitled") {
    const instructions = r2ActivationInstructions(
      accountId,
      config.instanceName,
    );
    if (explicitlyEnabled) {
      throw new Error(instructions);
    }
    prompts.note(instructions, "Media storage is still pending");
    return false;
  }

  if (!explicitlyEnabled) {
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
      !flagBoolean(context.flags, "yes");
    if (!interactive) {
      prompts.note(
        "R2 is now available. This non-interactive deployment will stay " +
          "content-only. Enable media uploads deterministically with " +
          `\`yarn manage deploy --enable-r2 --instance ${config.instanceName}\`.`,
        "Optional media storage available",
      );
      return false;
    }
    if (!await askConfirm("Add R2 media storage now?", true)) {
      config.r2.setupMode = "disabled";
      await writeConfig(config);
      await generateWranglerConfig(config);
      prompts.log.info(
        "R2 media storage was disabled for future deployments. Enable it " +
          `later with \`yarn manage deploy --enable-r2 --instance ${config.instanceName}\`.`,
      );
      return false;
    }
  }

  const bucketExists = availability === "exists";
  const reuseR2 = bucketExists
    ? await explicitReuse(
        context.flags,
        "reuse-r2",
        `R2 bucket \`${config.r2.name}\``,
        false,
      )
    : false;
  if (bucketExists && !reuseR2) {
    throw new Error(
      "R2 setup stopped before the Worker binding changed. The existing " +
        "bucket was not reused.",
    );
  }
  if (!bucketExists) {
    prompts.log.step(`Creating R2 bucket ${config.r2.name}`);
    try {
      await context.cloudflare.createR2(accountId, config.r2.name);
    } catch (error) {
      if (error instanceof R2NotEntitledError) {
        throw new Error(
          r2ActivationInstructions(accountId, config.instanceName),
        );
      }
      throw new Error(
        `R2 bucket \`${config.r2.name}\` and its saved binding could not be ` +
          "verified. The binding was not removed. Restore this account's R2 " +
          `permissions, then rerun status. ${errorMessage(error)}`,
      );
    }
  }
  config.r2.reuse = reuseR2;
  config.r2.setupMode = "automatic";
  markStep(config, "r2-ready");
  markStep(config, "r2-enable-pending");
  await writeConfig(config);
  await generateWranglerConfig(config);
  prompts.log.success(`R2 media storage ${config.r2.name}: ready to bind`);
  return true;
}

export async function verifyR2Deployment(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  try {
    const [bucketExists, bindings] = await Promise.all([
      context.cloudflare.r2BucketExists(
        cloudflareAccountId(config),
        config.r2.name,
      ),
      context.cloudflare.workerBindings(
        cloudflareAccountId(config),
        workerName(config),
      ),
    ]);
    const bindingExists = bindings.some(
      ({bucket_name: bucketName, name, type}) =>
        name === "MEDIA_BUCKET" &&
        type === "r2_bucket" &&
        bucketName === config.r2.name,
    );
    if (!bucketExists || !bindingExists) {
      throw new Error(
        `Cloudflare did not report the exact R2 bucket \`${config.r2.name}\` ` +
          "and MEDIA_BUCKET Worker binding after deployment.",
      );
    }
  } catch (error) {
    const accountId = cloudflareAccountId(config);
    if (error instanceof R2NotEntitledError) {
      throw new Error(
        "The Worker deployment completed, but Cloudflare no longer allows " +
          "this account to verify its R2 binding. The saved bucket and " +
          `binding were not removed. ${r2ActivationInstructions(
            accountId,
            config.instanceName,
          )}`,
      );
    }
    throw new Error(
      "The Worker deployment completed, but its R2 bucket and binding could " +
        "not be verified. The saved bucket and binding were not removed. " +
        `Restore R2 permissions, then rerun deployment. ${errorMessage(error)}`,
    );
  }
  config.completedSteps = config.completedSteps.filter(
    (step) => step !== "r2-enable-pending",
  );
  await writeConfig(config);
  prompts.log.success(
    `R2 ${config.r2.name}: exact bucket and MEDIA_BUCKET binding verified`,
  );
}

async function tryRecordDeferredR2RestoreBaseline(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (config.restoreBaseline || config.d1.reuse || config.r2.reuse) {
    return;
  }
  try {
    await assertFreshRemoteRestoreBaselineTarget(context, config);
    await saveVerifiedRemoteRestoreBaseline(context, config, {
      update: () => undefined,
    });
    prompts.log.success(
      "Fresh snapshot-restore baseline recorded after enabling R2.",
    );
  } catch (error) {
    prompts.log.warn(
      "R2 was enabled successfully, but this installation is no longer a " +
        "bootstrap-only empty snapshot target, so no restore baseline was " +
        `recorded. ${errorMessage(error)}`,
    );
  }
}

const WEBHOOK_CANCEL_PENDING_SQL = `UPDATE webhook_deliveries
SET status = 'canceled_webhooks_disabled',
  completed_at = CURRENT_TIMESTAMP, lease_until = NULL,
  error = 'Webhook infrastructure was disabled.',
  updated_at = CURRENT_TIMESTAMP
WHERE status IN ('pending', 'retrying')`;

const WEBHOOK_DESTROY_CANCEL_PENDING_SQL = `UPDATE webhook_deliveries
SET status = 'canceled_endpoint_disabled',
  completed_at = CURRENT_TIMESTAMP, lease_until = NULL,
  error = 'The microfeed deployment was destroyed.',
  updated_at = CURRENT_TIMESTAMP
WHERE status IN ('pending', 'retrying')`;
const WEBHOOK_DISABLE_PURGED_STEP = "webhook-disable-queue-purged";
const WEBHOOK_ACCESS_CHECK_SQL =
  "SELECT 1 AS microfeed_webhook_access_check";

type WebhookLifecycleAction = "enable" | "disable";

function webhookLifecycleDeployCommand(
  config: MicrofeedConfig,
  action: WebhookLifecycleAction,
): string {
  return [
    "yarn manage deploy",
    ...(config.deploymentEnvironment === "preview" ? ["--preview"] : []),
    `--${action}-webhooks`,
    `--instance ${config.instanceName}`,
    `--account-id ${cloudflareAccountId(config)}`,
  ].join(" ");
}

function webhookAuthenticationError(
  error: unknown,
  config: MicrofeedConfig,
  action: WebhookLifecycleAction,
  mutationStarted: boolean,
): Error {
  const command = webhookLifecycleDeployCommand(config, action);
  const recovery = mutationStarted
    ? config.webhooks?.transition
      ? "The webhook transition is recorded and remains safely resumable."
      : "The next run will verify the exact Queue identity before continuing."
    : "This attempt did not pause, create, purge, resume, or detach the Queue.";
  return new Error(
    "Cloudflare did not accept an authenticated request used to verify D1 " +
      "and Queue access " +
      "(code 10000). This can be a short-lived OAuth or Cloudflare API " +
      `failure. ${recovery}\n\nRerun the exact command in a fresh process:\n` +
      `${command}\n\nCloudflare reported:\n${errorMessage(error)}`,
  );
}

async function verifyWebhookLifecycleAccess(
  context: CommandContext,
  config: MicrofeedConfig,
  action: WebhookLifecycleAction,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await context.cloudflare.queryD1(config, WEBHOOK_ACCESS_CHECK_SQL);
      return;
    } catch (error) {
      if (!isCloudflareAuthenticationError(error)) throw error;
      lastError = error;
      if (attempt === 0) await delay(250);
    }
  }
  throw webhookAuthenticationError(lastError, config, action, false);
}

async function runWebhookLifecycleStep<T>(
  config: MicrofeedConfig,
  action: WebhookLifecycleAction,
  task: () => Promise<T>,
  mutationStarted = true,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (isCloudflareAuthenticationError(error)) {
      throw webhookAuthenticationError(
        error,
        config,
        action,
        mutationStarted,
      );
    }
    throw error;
  }
}

async function verifiedWebhookQueue(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<NonNullable<Awaited<ReturnType<CloudflareClient["queueByName"]>>>> {
  if (!webhookProvisioned(config) || !config.webhooks) {
    throw new Error("Webhook infrastructure has not been provisioned.");
  }
  const accountId = cloudflareAccountId(config);
  const queue = await context.cloudflare.queueByName(
    accountId,
    config.webhooks.queueName,
  );
  if (!queue) {
    throw new Error(
      `Webhook Queue \`${config.webhooks.queueName}\` is missing. It was ` +
        "not recreated because this saved instance previously owned a " +
        "specific Queue. Inspect Cloudflare before changing webhook state.",
    );
  }
  if (config.webhooks.queueId && config.webhooks.queueId !== queue.id) {
    throw new Error(
      `Webhook Queue \`${config.webhooks.queueName}\` now has ID ${queue.id}, ` +
        `but this instance owns ${config.webhooks.queueId}. The replacement ` +
        "Queue was not changed.",
    );
  }
  if (!config.webhooks.queueId) {
    config.webhooks.queueId = queue.id;
    await writeConfig(config);
    await generateWranglerConfig(config);
  }
  return queue;
}

async function provisionWebhookQueue(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  const accountId = cloudflareAccountId(config);
  const queueName = config.webhooks?.queueName ??
    webhookQueueName(workerName(config));
  if (await context.cloudflare.queueExists(accountId, queueName)) {
    throw new Error(
      `Queue \`${queueName}\` already exists and is not recorded as owned ` +
        "by this saved microfeed environment. It was not reused or changed.",
    );
  }
  prompts.log.step(`Creating webhook Queue ${queueName}`);
  const queue = await context.cloudflare.createQueue(accountId, queueName);
  config.webhooks = {
    queueId: queue.id,
    queueName,
    state: "disabled",
    transition: "enabling",
  };
  markStep(config, "webhook-queue-ready");
  await writeConfig(config);
  await generateWranglerConfig(config);
}

async function cancelPendingWebhookDeliveries(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  await context.cloudflare.queryD1(config, WEBHOOK_CANCEL_PENDING_SQL);
}

function verifiedWebhookQueueConsumers(
  consumers: QueueConsumer[],
  targetWorkerName: string,
): QueueConsumer[] {
  const expected = consumers.filter(({scriptName, type}) =>
    type === "worker" && scriptName === targetWorkerName
  );
  const unexpected = consumers.filter((consumer) =>
    !expected.includes(consumer)
  );
  if (unexpected.length > 0 || expected.length > 1) {
    const summary = consumers.map(({id, scriptName, type}) =>
      `${type}:${scriptName ?? "unknown"} (${id})`
    ).join(", ");
    throw new Error(
      `Webhook Queue has an unexpected consumer configuration: ${summary}. ` +
        `microfeed will detach only the single Worker consumer named ` +
        `\`${targetWorkerName}\`. No Queue consumers were detached.`,
    );
  }
  return expected;
}

async function detachWebhookQueueConsumer(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<number> {
  const accountId = cloudflareAccountId(config);
  const queue = await verifiedWebhookQueue(context, config);
  const consumers = await context.cloudflare.queueConsumers(
    accountId,
    queue.id,
  );
  const expectedConsumers = verifiedWebhookQueueConsumers(
    consumers,
    workerName(config),
  );
  for (const consumer of expectedConsumers) {
    await context.cloudflare.deleteQueueConsumer(
      accountId,
      queue.id,
      consumer.id,
    );
  }
  const remainingConsumers = await context.cloudflare.queueConsumers(
    accountId,
    queue.id,
  );
  if (remainingConsumers.length > 0) {
    throw new Error(
      `Cloudflare still reports a consumer for webhook Queue ${queue.name}. ` +
        "The Queue was retained and no other webhook resource was changed.",
    );
  }
  return expectedConsumers.length;
}

async function disabledWebhookDeploymentIsVerified(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<boolean> {
  if (!config.webhooks) return true;
  const accountId = cloudflareAccountId(config);
  const queue = await verifiedWebhookQueue(context, config);
  const [metrics, bindings, schedules, consumers] = await Promise.all([
    context.cloudflare.queueMetrics(accountId, config.webhooks.queueName),
    context.cloudflare.workerBindings(accountId, workerName(config)),
    context.cloudflare.workerSchedules(accountId, workerName(config)),
    context.cloudflare.queueConsumers(accountId, queue.id),
  ]);
  const bound = bindings.some(({name, type}) =>
    name === "WEBHOOK_QUEUE" && type === "queue"
  );
  return queue.deliveryPaused && metrics?.backlogCount === 0 && !bound &&
    consumers.length === 0 && schedules.length === 0;
}

async function webhookDisableDeploymentIsDetached(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<boolean> {
  const accountId = cloudflareAccountId(config);
  const [bindings, schedules] = await Promise.all([
    context.cloudflare.workerBindings(accountId, workerName(config)),
    context.cloudflare.workerSchedules(accountId, workerName(config)),
  ]);
  const bound = bindings.some(({name, type}) =>
    name === "WEBHOOK_QUEUE" && type === "queue"
  );
  return !bound && schedules.length === 0;
}

async function enabledWebhookDeploymentIsVerified(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<boolean> {
  if (!config.webhooks) return false;
  const accountId = cloudflareAccountId(config);
  const queue = await verifiedWebhookQueue(context, config);
  const [bindings, schedules, consumers] = await Promise.all([
    context.cloudflare.workerBindings(accountId, workerName(config)),
    context.cloudflare.workerSchedules(accountId, workerName(config)),
    context.cloudflare.queueConsumers(accountId, queue.id),
  ]);
  const bound = bindings.some((binding) =>
    binding.name === "WEBHOOK_QUEUE" && binding.type === "queue" &&
    (
      binding.queue_name === config.webhooks!.queueName ||
      binding.queue === config.webhooks!.queueName
    )
  );
  const consumerAttached = consumers.some((consumer) =>
    consumer.type === "worker" && consumer.scriptName === workerName(config)
  );
  return !queue.deliveryPaused && bound && consumerAttached &&
    schedules.length === 1 && schedules[0] === "0 * * * *";
}

export async function deployCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const enableWebhooks = flagBoolean(flags, "enable-webhooks");
  const disableWebhooks = flagBoolean(flags, "disable-webhooks");
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const preview = flagBoolean(flags, "preview");
  const local = flagBoolean(flags, "local");
  const enableR2 = flagBoolean(flags, "enable-r2");
  if (enableWebhooks && disableWebhooks) {
    throw new Error(
      "`--enable-webhooks` and `--disable-webhooks` cannot be combined.",
    );
  }
  if (preview && local) {
    throw new Error("`--preview` and `--local` cannot be used together.");
  }
  if (preview && enableR2) {
    throw new Error(
      "`--enable-r2` targets production media storage and cannot be used " +
        "with `--preview`.",
    );
  }
  if (local && flagBoolean(flags, "reuse-r2")) {
    throw new Error(
      "`--reuse-r2` applies only to Cloudflare buckets, not local " +
        "simulated storage.",
    );
  }
  if (local && disableWebhooks) {
    throw new Error(
      "`deploy --local --disable-webhooks` is not supported. Use " +
        "`yarn dev --disable-webhooks` to turn off simulation for one run.",
    );
  }
  prompts.intro(
    local
      ? "microfeed local deployment preparation"
      : preview
      ? "microfeed preview deployment"
      : "microfeed deployment",
  );
  await resolveCommandInstance(context);
  const config = await ensureWranglerConfig(
    local,
    preview,
    context.instanceName,
  );
  await verifyBundledThemeRelease(repositoryRoot);
  if (
    !local &&
    (enableWebhooks || disableWebhooks || webhookEnabled(config) ||
      config.webhooks?.transition)
  ) {
    context.cloudflare = new CloudflareClient(runner, ["queues:write"]);
  }
  if (local) {
    if (!isLocalOnly(config)) {
      throw new Error(
        `Instance \`${config.instanceName}\` is managed on Cloudflare. ` +
          "`deploy --local` is limited to instances created with " +
          "`init --local`.",
      );
    }
    if (enableR2 && !isR2Ready(config)) {
      config.r2.setupMode = "automatic";
      markStep(config, "r2-ready");
      await writeConfig(config);
    }
    if (enableWebhooks && !webhookEnabled(config)) {
      config.webhooks = {
        queueName: config.webhooks?.queueName ??
          webhookQueueName(workerName(config)),
        state: "enabled",
      };
      markStep(config, "webhook-queue-ready");
      markStep(config, "webhook-secret-created");
      await writeConfig(config);
    }
    await generateWranglerConfig(config);
    await context.cloudflare.applyLocalMigrations(config);
    await prepareItemSearch(context.cloudflare, config, {
      local: true,
      persistTo: localPersistencePath(config),
    });
    const {installDefaultThemeForV1Appearance} = await import("./theme");
    await installDefaultThemeForV1Appearance(config, context.runner, true);
    markStep(config, "migrations-applied");
    await writeConfig(config);
    await runChecks(context.runner, config);
    prompts.outro(
      `Local instance \`${config.instanceName}\` is migrated, checked, and ` +
        "built. Existing local data was preserved; no server was started.",
    );
    return;
  }
  const accountId = cloudflareAccountId(config);
  prompts.note(instanceTargetMessage(config), "Deployment target");
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error(
      `This installation belongs to Cloudflare account ${accountId}.`,
    );
  }
  let finishWebhookDisable = disableWebhooks ||
    config.webhooks?.transition === "disabling";
  let finishWebhookEnable = enableWebhooks ||
    config.webhooks?.transition === "enabling";
  let resumeDetachedWebhookDisable = false;

  if (enableWebhooks && config.webhooks?.transition === "disabling") {
    throw new Error(
      "Webhook disabling is incomplete. Rerun deploy without a webhook flag " +
        "or with --disable-webhooks before enabling it again.",
    );
  }
  if (disableWebhooks && config.webhooks?.transition === "enabling") {
    throw new Error(
      "Webhook enablement is incomplete. Rerun deploy without a webhook flag " +
        "or with --enable-webhooks before disabling it again.",
    );
  }
  if (finishWebhookEnable && finishWebhookDisable) {
    throw new Error(
      "The saved webhook transition is inconsistent. No webhook resource " +
        "was changed.",
    );
  }

  if (finishWebhookEnable) {
    let accessVerified = false;
    if (!webhookProvisioned(config)) {
      await verifyWebhookLifecycleAccess(context, config, "enable");
      accessVerified = true;
      await runWebhookLifecycleStep(config, "enable", () =>
        provisionWebhookQueue(context, config)
      );
    }
    const queue = await runWebhookLifecycleStep(
      config,
      "enable",
      () => verifiedWebhookQueue(context, config),
      Boolean(config.webhooks?.transition),
    );
    const alreadyEnabled = webhookEnabled(config) &&
      !config.webhooks?.transition &&
      await runWebhookLifecycleStep(
        config,
        "enable",
        () => enabledWebhookDeploymentIsVerified(context, config),
        false,
      );
    if (alreadyEnabled) {
      finishWebhookEnable = false;
      prompts.log.info(
        `Webhooks are already enabled with Queue ${queue.name}; its exact ` +
          "identity, consumer, binding, delivery state, and Cron were verified.",
      );
    } else {
      if (!accessVerified) {
        await verifyWebhookLifecycleAccess(context, config, "enable");
      }
      config.webhooks!.state = "enabled";
      config.webhooks!.transition = "enabling";
      await writeConfig(config);
      await generateWranglerConfig(config);
      if (!queue.deliveryPaused) {
        await runWebhookLifecycleStep(config, "enable", () =>
          context.cloudflare.pauseQueue(accountId, queue.name)
        );
      }
    }
  }

  if (finishWebhookDisable) {
    if (!webhookProvisioned(config)) {
      finishWebhookDisable = false;
      prompts.log.info(
        "Webhooks were never provisioned. The deployment will verify that " +
          "no Queue binding or Cron remains.",
      );
    } else if (
      webhookState(config) === "disabled" &&
      !config.webhooks?.transition &&
      await runWebhookLifecycleStep(
        config,
        "disable",
        () => disabledWebhookDeploymentIsVerified(context, config),
        false,
      )
    ) {
      prompts.outro(
        `Webhooks are already disabled for ${preview ? "preview" : "production"}. ` +
          `Queue ${config.webhooks!.queueName} remains paused and empty.`,
      );
      return;
    } else {
      const resumingDisable = config.webhooks?.transition === "disabling";
      const queue = await runWebhookLifecycleStep(
        config,
        "disable",
        () => verifiedWebhookQueue(context, config),
        resumingDisable,
      );
      await verifyWebhookLifecycleAccess(context, config, "disable");
      config.webhooks!.state = "disabled";
      config.webhooks!.transition = "disabling";
      await writeConfig(config);
      await generateWranglerConfig(config);
      if (!queue.deliveryPaused) {
        await runWebhookLifecycleStep(config, "disable", () =>
          context.cloudflare.pauseQueue(accountId, queue.name)
        );
      }
      if (
        resumingDisable && !enableR2 &&
        await runWebhookLifecycleStep(config, "disable", () =>
          webhookDisableDeploymentIsDetached(context, config)
        )
      ) {
        resumeDetachedWebhookDisable = true;
        prompts.log.info(
          "Webhook Queue binding and Cron are already removed; continuing " +
            "the interrupted disable without redeploying the Worker.",
        );
      } else {
        await runWebhookLifecycleStep(config, "disable", () =>
          context.cloudflare.applyMigrations(config)
        );
      }
      await runWebhookLifecycleStep(config, "disable", () =>
        cancelPendingWebhookDeliveries(context, config)
      );
    }
  }
  if (!resumeDetachedWebhookDisable) {
    const pages = await context.cloudflare.pagesProjects(accountId);
    const targetWorkerName = workerName(config);
    if (pages.includes(targetWorkerName)) {
      throw new Error(pagesCollisionMessage(targetWorkerName));
    }
    const enabledR2Now = await prepareR2ForDeployment(
      context,
      config,
      enableR2,
    );
    const r2EnablePending = enabledR2Now ||
      config.completedSteps.includes("r2-enable-pending");
    try {
      await deployConfiguredProject(context, config, false);
    } catch (error) {
      if (finishWebhookDisable && isCloudflareAuthenticationError(error)) {
        throw webhookAuthenticationError(error, config, "disable", true);
      }
      if (finishWebhookEnable && isCloudflareAuthenticationError(error)) {
        throw webhookAuthenticationError(error, config, "enable", true);
      }
      const detail = errorMessage(error);
      if (
        isR2Ready(config) &&
        /(?:\br2\b|media_bucket|10042|notentitled)/iu.test(detail)
      ) {
        throw new Error(
          `${detail}\n\nThe saved R2 bucket and MEDIA_BUCKET binding were not ` +
            "removed. Restore this account's R2 billing and permissions, then " +
            `rerun \`yarn manage deploy --instance ${config.instanceName}\`.`,
        );
      }
      throw error;
    }
    if (r2EnablePending) {
      await verifyR2Deployment(context, config);
      await tryRecordDeferredR2RestoreBaseline(context, config);
    }
  }
  if (finishWebhookDisable && config.webhooks) {
    await runWebhookLifecycleStep(config, "disable", async () => {
      await cancelPendingWebhookDeliveries(context, config);
      const detachedConsumers = await detachWebhookQueueConsumer(
        context,
        config,
      );
      prompts.log.success(
        detachedConsumers > 0
          ? "Webhook Queue consumer: detached"
          : "Webhook Queue consumer: already absent",
      );
      if (!config.completedSteps.includes(WEBHOOK_DISABLE_PURGED_STEP)) {
        await context.cloudflare.purgeQueue(
          accountId,
          config.webhooks!.queueName,
        );
        markStep(config, WEBHOOK_DISABLE_PURGED_STEP);
        await writeConfig(config);
      }
      if (!await disabledWebhookDeploymentIsVerified(context, config)) {
        throw new Error(
          "Webhook disabling did not verify cleanly. The Queue was retained; " +
            "rerun the same command to resume verification.",
        );
      }
      delete config.webhooks!.transition;
      config.completedSteps = config.completedSteps.filter(
        (step) => step !== WEBHOOK_DISABLE_PURGED_STEP,
      );
      await writeConfig(config);
      await generateWranglerConfig(config);
      prompts.log.success(
        `Webhooks disabled; Queue ${config.webhooks!.queueName} was retained, ` +
          "paused, and emptied.",
      );
    });
  }
  if (finishWebhookEnable && config.webhooks) {
    await runWebhookLifecycleStep(config, "enable", async () => {
      await context.cloudflare.resumeQueue(
        accountId,
        config.webhooks!.queueName,
      );
      if (!await enabledWebhookDeploymentIsVerified(context, config)) {
        throw new Error(
          "Webhook enablement did not verify cleanly. The existing Queue was " +
            "not replaced; rerun the same command to resume verification.",
        );
      }
      delete config.webhooks!.transition;
      await writeConfig(config);
      await generateWranglerConfig(config);
      prompts.log.success(
        `Webhooks enabled with existing Queue ${config.webhooks!.queueName}.`,
      );
    });
  }
  prompts.outro(deploymentOutcomeMessage(config, preview));
}

export async function migratePagesCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  if (flagBoolean(flags, "preview")) {
    throw new Error(
      "`migrate-pages` already creates a side-by-side Worker for migration " +
      "verification and does not support `--preview`.",
    );
  }
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  prompts.intro("Migrate a Pages installation side by side");
  const requestedInstance = flagString(flags, "instance") ??
    process.env.MICROFEED_INSTANCE;
  if (requestedInstance) {
    const error = validateLocalInstanceName(requestedInstance);
    if (error) {
      throw new Error(
        `Invalid instance name \`${requestedInstance}\`. ${error}`,
      );
    }
    context.instanceName = requestedInstance;
    if (await readConfig(false, requestedInstance)) {
      throw new Error(
        `Instance \`${requestedInstance}\` is already configured. ` +
          "Choose another name or deploy the existing instance.",
      );
    }
  }
  const account = await authenticate(context);
  const pagesProjects = await context.cloudflare.pagesProjects(account.id);
  if (pagesProjects.length === 0) {
    throw new Error("No Pages projects were found in this account.");
  }
  const pagesName = flagString(flags, "pages-name") ??
    await choosePagesProject(pagesProjects);
  if (!pagesProjects.includes(pagesName)) {
    throw new Error(`Pages project \`${pagesName}\` was not found.`);
  }
  const workerName = await resourceName(
    flags,
    "project-name",
    "New Worker name (must be different)",
    `${pagesName}-worker`,
  );
  const migrationInstanceName = context.instanceName ??
    normalizeLocalInstanceName(workerName);
  if (
    !context.instanceName &&
    await readConfig(false, migrationInstanceName)
  ) {
    throw new Error(
      `Instance \`${migrationInstanceName}\` is already configured. ` +
        "Choose another Worker name or pass a new `--instance` name.",
    );
  }
  context.instanceName = migrationInstanceName;
  const adminPath = await configuredAdminPath(flags, "admin");
  if (workerName === pagesName) {
    throw new Error(
      "The Worker name must differ from the Pages project name.",
    );
  }
  await assertNoPagesCollision(context.cloudflare, account.id, workerName);
  if (await context.cloudflare.workerExists(account.id, workerName)) {
    throw new Error(
      `Worker \`${workerName}\` already exists. Choose a different name.`,
    );
  }

  const d1Name = await resourceName(
    flags,
    "d1-name",
    "Existing D1 database name",
    `${pagesName}_feed_db_production`,
  );
  const r2Name = await resourceName(
    flags,
    "r2-name",
    "Existing R2 bucket name",
    pagesName,
  );
  const [databases, r2Exists] = await Promise.all([
    context.cloudflare.d1Databases(account.id),
    context.cloudflare.r2BucketExists(account.id, r2Name),
  ]);
  const database = databases.find(({name}) => name === d1Name);
  if (!database) {
    throw new Error(`D1 database \`${d1Name}\` was not found.`);
  }
  if (!r2Exists) {
    throw new Error(`R2 bucket \`${r2Name}\` was not found.`);
  }
  if (
    !flagBoolean(flags, "yes") &&
    !await askConfirm(
      `Reuse D1 \`${d1Name}\` and R2 \`${r2Name}\` without changing Pages?`,
      true,
    )
  ) {
    throw new Error("Migration cancelled before changing any resources.");
  }

  const config: MicrofeedConfig = {
    accountId: account.id,
    adminPath,
    completedSteps: ["d1-ready", "r2-ready"],
    customDomain: null,
    d1: {id: database.id, name: d1Name, reuse: true},
    deploymentUrl: null,
    hosting: "cloudflare",
    instanceId: randomUUID(),
    instanceName: context.instanceName,
    pagesProjectName: pagesName,
    projectName: workerName,
    r2: {name: r2Name, reuse: true, setupMode: "automatic"},
  };
  context.instanceName = config.instanceName;
  await setActiveInstance(context.instanceName);
  await writeConfig(config);
  await deployConfiguredProject(context, config, true, true);
  prompts.log.success(`Side-by-side Worker is live at ${config.deploymentUrl}`);
  await finishInitialAdminSetup(context, config);
  if (!flagBoolean(context.flags, "yes")) {
    prompts.note(
      adminAuthMode(config) === "built-in"
        ? `The side-by-side dashboard has its own sign-in at ` +
          `${new URL(
            adminBasePath(config.adminPath),
            config.deploymentUrl!,
          ).href}. It stays locked with HTTP 403 until the browser password ` +
          "step is complete. Cloudflare Access remains available as an " +
          "optional second gate."
        : `The side-by-side dashboard at ${new URL(
            adminBasePath(config.adminPath),
            config.deploymentUrl!,
          ).href} is public. Run \`yarn manage access\` before using it, ` +
          "or add the built-in login with `yarn manage auth setup`.",
      adminAuthMode(config) === "built-in"
        ? "Dashboard login setup"
        : "Warning: admin authentication skipped",
    );
  }
  prompts.note(
    "Keep Pages online while you verify public pages, JSON/RSS feeds, " +
    "admin edits, uploads, and existing media. For a custom domain, run " +
    "`yarn manage domain`. If it is still attached to Pages, the command links " +
    "to the exact Pages Custom Domains page and stops. Remove the domain " +
    "there, then rerun the command. Nothing in this migration command " +
    "modifies or deletes Pages.",
    "Traffic cutover",
  );
  prompts.outro(`Side-by-side Worker verified at ${config.deploymentUrl}`);
}

function normalizeHostname(value: string): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.pathname !== "/" || url.search || url.hash || url.port) {
    throw new Error("Enter only a hostname, for example feed.example.com.");
  }
  return url.hostname.toLowerCase();
}

export async function domainCommand(
  contextOrFlags: CommandContext | Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context = commandContext(contextOrFlags, runner);
  if (flagBoolean(context.flags, "preview")) {
    throw new Error(
      "Preview deployments use their workers.dev URL. Configure a custom " +
      "domain on the production environment instead.",
    );
  }
  await resolveCommandInstance(context);
  const config = await ensureWranglerConfig(
    false,
    false,
    context.instanceName,
  );
  const accountId = cloudflareAccountId(config);
  prompts.note(instanceTargetMessage(config), "Custom-domain target");
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  const pendingPasswordSetup: AuthPasswordSetup | null =
    adminAuthMode(config) === "built-in" &&
      !await context.cloudflare.authOwner(config)
      ? await context.cloudflare.authPasswordSetup(config)
      : null;
  const hostname = normalizeHostname(
    flagString(context.flags, "hostname") ??
    await askText("Custom domain hostname", config.customDomain ?? ""),
  );
  if (config.pagesProjectName) {
    const pagesDomainAttached = await pagesDomainIsAttached(
      context.cloudflare,
      accountId,
      config.pagesProjectName,
      hostname,
    );
    if (pagesDomainAttached) {
      prompts.note(
        pagesDomainAttachedMessage(
          accountId,
          config.pagesProjectName,
          hostname,
        ),
        "Manual Pages cutover required",
      );
      throw new Error(
        `No changes were made. Run \`yarn manage domain\` again after ` +
          `removing ${hostname} from Pages.`,
      );
    }
  }
  config.customDomain = hostname;
  await generateWranglerConfig(config);
  await writeConfig(config);
  await deployConfiguredProject(context, config, false);
  markStep(config, "custom-domain-verified");
  await writeConfig(config);
  prompts.log.success(`Custom domain verified: https://${hostname}`);

  if (pendingPasswordSetup) {
    await issuePasswordSetupLink(context, config, {
      email: pendingPasswordSetup.email,
      purpose: pendingPasswordSetup.purpose,
      userId: pendingPasswordSetup.userId,
    });
    prompts.log.info(
      "The previous password link was replaced because the public hostname " +
        "changed.",
    );
  }

  const workersDevUrl = config.deploymentUrl &&
      new URL(config.deploymentUrl).hostname.endsWith(".workers.dev")
    ? config.deploymentUrl
    : null;
  const workerDashboard = workersAndPagesDashboardUrl(accountId);
  prompts.note(
    `All public traffic now uses https://${hostname}. ` +
      `${workersDevUrl ?? "The workers.dev address"} is disabled by default. ` +
      "You can enable it from the Cloudflare dashboard if needed:\n" +
      `${workerDashboard}\n\nSelect ${workerName(config)} → Settings → ` +
      "Domains & Routes → workers.dev. A later microfeed deployment will " +
      "restore the safer disabled default.",
    "Public address updated",
  );

  if (!flagBoolean(context.flags, "yes")) {
    const adminUrl =
      `https://${hostname}${adminBasePath(config.adminPath)}`;
    if (
      adminAuthMode(config) === "built-in" &&
      !await context.cloudflare.authOwner(config)
    ) {
      prompts.note(
        `${adminUrl} remains locked with HTTP 403 until the dashboard ` +
          "password is created.",
        "Dashboard safely locked",
      );
      return;
    }
    const protection = await anonymousAdminProtection(
      `https://${hostname}`,
      config.adminPath,
      context.runner,
    );
    const notice = adminProtectionNotice(
      protection,
      adminAuthMode(config) === "built-in",
      adminUrl,
    );
    prompts.note(
      notice.message,
      notice.title,
    );
  }
}

export async function anonymousAdminProtection(
  baseUrl: string,
  adminPath: string,
  runner?: CommandRunner,
): Promise<AdminProtection> {
  const response = await verificationHttpGet(
    new URL(adminBasePath(adminPath), baseUrl),
    runner,
    undefined,
    "manual",
  );
  if (![301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
    return null;
  }
  if (
    response.location.includes("/cdn-cgi/access/") ||
    response.status === 401 ||
    response.status === 403
  ) {
    return "access";
  }
  return response.location.includes(`${adminBasePath(adminPath)}login/`)
    ? "built-in"
    : null;
}

async function anonymousPublicRoutesAreAvailable(
  baseUrl: string,
  runner?: CommandRunner,
): Promise<boolean> {
  const response = await verificationHttpGet(
    new URL("/.well-known/microfeed.json", baseUrl),
    runner,
    undefined,
    "manual",
  );
  return response.status >= 200 && response.status < 300;
}

export async function accessCommand(
  contextOrFlags: CommandContext | Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context = commandContext(contextOrFlags, runner);
  const preview = flagBoolean(context.flags, "preview");
  await resolveCommandInstance(context);
  const config = await ensureWranglerConfig(
    false,
    preview,
    context.instanceName,
  );
  const accountId = cloudflareAccountId(config);
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  const hostname = config.customDomain ??
    (config.deploymentUrl ? new URL(config.deploymentUrl).hostname : null);
  if (!hostname) {
    throw new Error("Deploy microfeed before configuring Access.");
  }
  const dashboardUrl = accessApplicationDashboardUrl(accountId);
  prompts.note(
    accessSetupInstructions(hostname, config.adminPath),
    "Cloudflare Access",
  );
  const shouldOpen =
    flagBoolean(context.flags, "open") ||
    (!flagBoolean(context.flags, "yes") &&
      await askConfirm(
        `Open Cloudflare to protect ` +
          `https://${hostname}${adminBasePath(config.adminPath)} now?`,
        true,
      ));
  if (!shouldOpen) {
    if (!flagBoolean(context.flags, "yes")) {
      prompts.note(
        "Run `yarn manage access` whenever you are ready.",
        "Access setup skipped",
      );
    }
    return;
  }
  await openUrl(context.runner, dashboardUrl);
  if (
    !flagBoolean(context.flags, "yes") &&
    await askConfirm("I saved the Access application. Verify it now?", true)
  ) {
    if (
      await anonymousAdminProtection(
        `https://${hostname}`,
        config.adminPath,
        context.runner,
      ) !== "access"
    ) {
      throw new Error(
        `Anonymous ${adminBasePath(config.adminPath)} was not intercepted ` +
        "by Cloudflare Access.",
      );
    }
    if (
      !await anonymousPublicRoutesAreAvailable(
        `https://${hostname}`,
        context.runner,
      )
    ) {
      throw new Error(
        "Cloudflare Access is also intercepting public microfeed routes. " +
        "Edit the Access application to use destination type Public " +
        `hostname, hostname ${hostname}, and path ${config.adminPath}.`,
      );
    }
    markStep(
      config,
      workersDevEnabled(config)
        ? "workers-dev-access-verified"
        : "custom-domain-access-verified",
    );
    await writeConfig(config);
    prompts.log.success(
      "The admin dashboard is protected and public routes remain available.",
    );
  }
}

export async function statusCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const preview = flagBoolean(flags, "preview");
  await resolveCommandInstance(context);
  const config = await ensureWranglerConfig(
    false,
    preview,
    context.instanceName,
  );
  if (webhookProvisioned(config)) {
    context.cloudflare = new CloudflareClient(runner, ["queues:write"]);
  }
  const accountId = cloudflareAccountId(config);
  const targetWorkerName = workerName(config);
  prompts.intro(
    `microfeed ${preview ? "preview " : ""}status: ${targetWorkerName}`,
  );
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  const [worker, databases] = await Promise.all([
    context.cloudflare.workerExists(accountId, targetWorkerName),
    context.cloudflare.d1Databases(accountId),
  ]);
  const bindings = worker
    ? await context.cloudflare.workerBindings(accountId, targetWorkerName)
    : [];
  const d1Resource = databases.some(
    ({id, name}) => id === config.d1.id && name === config.d1.name,
  );
  const d1Binding = bindings.some((binding) =>
    binding.name === "FEED_DB" &&
    binding.type === "d1" &&
    (binding.database_id === config.d1.id || binding.id === config.d1.id)
  );
  const d1 = d1Resource && d1Binding;
  let r2 = false;
  if (isR2Ready(config)) {
    try {
      const r2Resource = await context.cloudflare.r2BucketExists(
        accountId,
        config.r2.name,
      );
      const r2Binding = bindings.some(
        ({bucket_name: name, name: binding, type}) =>
          binding === "MEDIA_BUCKET" &&
          type === "r2_bucket" &&
          name === config.r2.name,
      );
      r2 = r2Resource && r2Binding;
    } catch (error) {
      if (error instanceof R2NotEntitledError) {
        throw new Error(
          "This installation already has an R2 binding, but Cloudflare no " +
            "longer allows the account to verify it. The binding was not " +
            `removed. ${r2ActivationInstructions(
              accountId,
              config.instanceName,
            )}`,
        );
      }
      throw new Error(
        "This installation already has an R2 binding, but Cloudflare could " +
          "not verify it. The binding was not removed. Restore this " +
          `account's R2 permissions, then rerun status. ${errorMessage(error)}`,
      );
    }
  }
  let webhookQueue = true;
  const schedules = worker
    ? await context.cloudflare.workerSchedules(accountId, targetWorkerName)
    : [];
  if (webhookProvisioned(config) && config.webhooks) {
    const [queueResource, queueMetrics, operationMetrics] = await Promise.all([
      context.cloudflare.queueByName(accountId, config.webhooks.queueName),
      context.cloudflare.queueMetrics(accountId, config.webhooks.queueName),
      context.cloudflare.queueOperationMetrics(
        accountId,
        config.webhooks.queueName,
      ),
    ]);
    const consumers = queueResource
      ? await context.cloudflare.queueConsumers(accountId, queueResource.id)
      : [];
    const expectedConsumer = consumers.some((consumer) =>
      consumer.type === "worker" && consumer.scriptName === targetWorkerName
    );
    const queueBinding = bindings.some((binding) =>
      binding.name === "WEBHOOK_QUEUE" &&
      binding.type === "queue" &&
      (
        binding.queue_name === config.webhooks!.queueName ||
        binding.queue === config.webhooks!.queueName
      )
    );
    const queueIdentity = Boolean(
      queueResource &&
      (!config.webhooks.queueId || config.webhooks.queueId === queueResource.id),
    );
    if (webhookEnabled(config)) {
      webhookQueue = Boolean(
        queueIdentity && queueMetrics && queueBinding &&
        !queueResource?.deliveryPaused &&
        expectedConsumer && consumers.length === 1 &&
        schedules.length === 1 && schedules[0] === "0 * * * *",
      );
    } else {
      webhookQueue = Boolean(
        queueIdentity && queueMetrics && !queueBinding &&
        queueResource?.deliveryPaused && queueMetrics.backlogCount === 0 &&
        consumers.length === 0 && schedules.length === 0,
      );
    }
    if (webhookQueue && queueMetrics && webhookEnabled(config)) {
      const oldest = queueMetrics.oldestMessageTimestampMs > 0
        ? new Date(queueMetrics.oldestMessageTimestampMs).toISOString()
        : "none";
      const rows = await context.cloudflare.queryD1(
        config,
        `SELECT
          (SELECT COALESCE(SUM(deliveries), 0) FROM webhook_daily_usage
            WHERE usage_day = date('now')) AS writes,
          (SELECT COUNT(*) FROM webhook_delivery_attempts
            WHERE created_at >= date('now')) AS reads,
          (SELECT COUNT(*) FROM webhook_deliveries
            WHERE completed_at >= date('now')) AS deletes,
          (SELECT COUNT(*) FROM webhook_delivery_attempts
            WHERE attempt_number > 1 AND created_at >= date('now')) AS retries`,
      );
      const accounting = rows[0] ?? {};
      const queueOperations = operationMetrics?.queue;
      const accountOperations = operationMetrics?.account;
      prompts.log.success(
        `Webhook Queue ${config.webhooks.queueName}: exact resource and ` +
          `WEBHOOK_QUEUE binding and Worker consumer found\n  Realtime backlog: ${queueMetrics.backlogCount} ` +
          `messages / ${queueMetrics.backlogBytes} bytes\n  Oldest message: ${oldest}\n` +
          `  Cloudflare Queue operations since UTC midnight: writes ${queueOperations?.writes ?? 0}, ` +
          `reads ${queueOperations?.reads ?? 0}, deletes ${queueOperations?.deletes ?? 0}, ` +
          `total ${queueOperations?.total ?? 0}, average retries/message ` +
          `${(queueOperations?.averageRetriesPerMessage ?? 0).toFixed(2)}\n` +
          `  Account-wide Queue operations in the same window: writes ${accountOperations?.writes ?? 0}, ` +
          `reads ${accountOperations?.reads ?? 0}, deletes ${accountOperations?.deletes ?? 0}, ` +
          `total ${accountOperations?.total ?? 0}\n` +
          `  Today's microfeed delivery accounting: reserved writes ${Number(accounting.writes ?? 0)}, ` +
          `attempt reads ${Number(accounting.reads ?? 0)}, completed deletes ${Number(accounting.deletes ?? 0)}, ` +
          `retry attempts ${Number(accounting.retries ?? 0)}\n  Observed: ` +
          `${operationMetrics?.observedAt ?? queueMetrics.observedAt}`,
      );
    } else if (webhookQueue) {
      prompts.log.success(
        `Webhook Queue ${config.webhooks.queueName}: retained with exact ` +
          `identity, paused, empty, and detached\n  Cron triggers: none`,
      );
    } else {
      const consumerSummary = consumers.length
        ? consumers.map((consumer) =>
          `${consumer.type}:${consumer.scriptName ?? consumer.id}`
        ).join(", ")
        : "none";
      prompts.log.error(
        `Webhook Queue ${config.webhooks.queueName}: saved ${webhookState(config)} ` +
          "state does not match its Cloudflare resources\n" +
          `  Queue identity: ${queueIdentity ? "exact" : "missing or replaced"}\n` +
          `  Realtime metrics: ${queueMetrics ? "available" : "unavailable"}\n` +
          `  WEBHOOK_QUEUE binding: ${queueBinding ? "found" : "missing"}\n` +
          `  Delivery: ${queueResource?.deliveryPaused ? "paused" : "resumed"}\n` +
          `  Expected Worker consumer: ${expectedConsumer ? "found" : "missing"} ` +
          `(${consumerSummary})\n  Cron triggers: ${schedules.length ? schedules.join(", ") : "none"}`,
      );
    }
  } else {
    const queueBinding = bindings.some(({name, type}) =>
      name === "WEBHOOK_QUEUE" && type === "queue"
    );
    webhookQueue = !queueBinding && schedules.length === 0;
    if (webhookQueue) {
      prompts.log.info("Webhooks: not provisioned; no Queue or Cron is expected");
    } else {
      prompts.log.error(
        "Webhooks: unprovisioned state has an unexpected Queue binding or Cron",
      );
    }
  }
  if (worker) {
    prompts.log.success(`Worker ${targetWorkerName}: found`);
  } else {
    prompts.log.error(`Worker ${targetWorkerName}: missing`);
  }
  if (d1) {
    prompts.log.success(`D1 ${config.d1.name}: bound resource found`);
  } else {
    prompts.log.error(`D1 ${config.d1.name}: missing`);
  }
  if (isR2Ready(config) && r2) {
    prompts.log.success(
      `R2 ${config.r2.name}: exact bucket and MEDIA_BUCKET binding found`,
    );
  } else if (isR2Ready(config)) {
    prompts.log.error(`R2 ${config.r2.name}: missing`);
  } else if (config.r2.setupMode === "disabled") {
    prompts.log.info(
      `R2 ${config.r2.name}: disabled by user; content-only deployment healthy`,
    );
  } else {
    prompts.log.warn(
      `R2 ${config.r2.name}: subscription pending; content-only deployment healthy`,
    );
  }
  const builtInAuthEnabled = adminAuthMode(config) === "built-in";
  const [owner, passwordSetup] = d1 && builtInAuthEnabled
    ? await Promise.all([
        context.cloudflare.authOwner(config),
        context.cloudflare.authPasswordSetup(config),
      ])
    : [null, null] as const;
  const passwordSetupActive = Boolean(
    passwordSetup && new Date(passwordSetup.expiresAt).getTime() > Date.now(),
  );
  if (!builtInAuthEnabled) {
    prompts.log.warn(
      "Built-in admin authentication: skipped; checking Cloudflare Access",
    );
  } else if (owner) {
    prompts.log.success(`Administrator account: ${owner.email}`);
    if (passwordSetup?.purpose === "reset") {
      prompts.log.warn(
        passwordSetupActive
          ? `A one-time password-reset link is active until ${
              passwordSetup.expiresAt
            }. The current login remains active until it is used.`
          : "An expired password-reset link remains recorded. Create a new " +
            "one with `yarn manage auth reset-password` if needed.",
      );
    }
  } else {
    prompts.log.warn("Administrator account: waiting for browser password setup");
    if (passwordSetupActive) {
      prompts.log.info(
        `One-time password setup is pending for ${passwordSetup!.email} ` +
          `until ${passwordSetup!.expiresAt}. The dashboard is locked.`,
      );
    } else if (passwordSetup) {
      prompts.log.error(
        "The password setup link expired. Generate a replacement with " +
          "`yarn manage auth setup`.",
      );
    } else {
      prompts.log.error(
        "No password setup link exists. Generate one with " +
          "`yarn manage auth setup`.",
      );
    }
  }

  const verificationUrl = deploymentVerificationUrl(config);
  let verifiedAdminProtection: AdminProtection = null;
  let pendingDashboardLocked = false;
  if (verificationUrl) {
    await verifyDeployment(config, verificationUrl, {
      runner: context.runner,
    });
    prompts.log.success(
      config.customDomain
        ? `Custom domain verified: ${verificationUrl}`
        : `Deployment verified: ${verificationUrl}`,
    );
    if (builtInAuthEnabled && !owner) {
      const dashboardResponse = await verificationHttpGet(
        new URL(adminBasePath(config.adminPath), verificationUrl),
        context.runner,
        undefined,
        "manual",
      );
      if (dashboardResponse.status === 403) {
        pendingDashboardLocked = true;
        prompts.log.success(
          `${adminBasePath(config.adminPath)}*: safely locked with HTTP 403 ` +
            "until the owner creates a password",
        );
      } else {
        prompts.log.error(
          `${adminBasePath(config.adminPath)}*: expected HTTP 403 while ` +
            `password setup is pending; received ${dashboardResponse.status}`,
        );
      }
    } else {
      verifiedAdminProtection = await anonymousAdminProtection(
        verificationUrl,
        config.adminPath,
        context.runner,
      );
    }
    if (builtInAuthEnabled && !owner) {
      // The pending-password state has its own explicit 403 result above.
    } else if (verifiedAdminProtection) {
      const protectionLabel = verifiedAdminProtection === "access"
        ? (
          builtInAuthEnabled
            ? "Cloudflare Access and built-in login active"
            : "Cloudflare Access active"
        )
        : "built-in login active";
      prompts.log.success(
        `${adminBasePath(config.adminPath)}*: ${protectionLabel}`,
      );
    } else if (!builtInAuthEnabled) {
      prompts.log.warn(
        `${adminBasePath(config.adminPath)}*: public and unprotected`,
      );
    } else {
      prompts.log.error(
        `${adminBasePath(config.adminPath)}*: login is not active`,
      );
    }
  }
  if (!worker || !d1 || (isR2Ready(config) && !r2) || !webhookQueue) {
    throw new Error("One or more required Cloudflare resources are missing.");
  }
  if (builtInAuthEnabled && !owner) {
    throw new Error(
      !pendingDashboardLocked
        ? "Deployment is reachable, but the dashboard was not safely locked " +
          "with HTTP 403. Run `yarn manage deploy`, then check status again."
        : passwordSetupActive
        ? "Deployment is healthy and the dashboard is safely locked. Open " +
          "the one-time link printed during initialization to create the " +
          "password, then " +
          "run `yarn manage status` again."
        : "Deployment is healthy and the dashboard is safely locked, but a " +
          "usable password link is missing. Run `yarn manage auth setup`.",
    );
  }
  prompts.outro(
    verifiedAdminProtection
      ? "Status checks passed."
      : (
        builtInAuthEnabled
          ? "Status checks completed, but dashboard protection was not verified."
          : "Status checks passed with a public admin dashboard warning."
      ),
  );
}

interface DestroyInspection {
  d1Exists: boolean;
  domains: Awaited<ReturnType<CloudflareClient["workerDomains"]>>;
  queueConsumers: QueueConsumer[];
  r2Exists: boolean;
  queue: Awaited<ReturnType<CloudflareClient["queueByName"]>>;
  queueExists: boolean;
  queueMetrics: Awaited<ReturnType<CloudflareClient["queueMetrics"]>>;
  schedules: string[];
  workerExists: boolean;
}

const DESTROY_WORKER_STEP = "destroy-worker-deleted";
const DESTROY_DOMAINS_STEP = "destroy-domains-detached";
const DESTROY_D1_STEP = "destroy-d1-deleted";
const DESTROY_R2_STEP = "destroy-r2-deleted";
const DESTROY_CRON_STEP = "destroy-webhook-crons-removed";
const DESTROY_CONSUMER_STEP = "destroy-webhook-consumer-detached";
const DESTROY_QUEUE_STEP = "destroy-webhook-queue-deleted";

function normalizedHostnames(hostnames: string[]): string[] {
  return hostnames.map((hostname) => hostname.toLowerCase().replace(/\.$/u, ""))
    .sort((left, right) => left.localeCompare(right));
}

function sameHostnames(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizedHostnames(left);
  const normalizedRight = normalizedHostnames(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((hostname, index) =>
      hostname === normalizedRight[index]
    );
}

async function inspectDestroyTarget(
  context: CommandContext,
  account: Account,
  config: MicrofeedConfig,
): Promise<DestroyInspection> {
  const accountId = account.id;
  const targetWorkerName = workerName(config);
  const [workerExists, databases, r2Exists, domains, queue, queueMetrics, schedules] = await Promise.all([
    context.cloudflare.workerExists(accountId, targetWorkerName),
    context.cloudflare.d1Databases(accountId),
    isR2Ready(config)
      ? context.cloudflare.r2BucketExists(accountId, config.r2.name)
      : Promise.resolve(false),
    context.cloudflare.workerDomains(accountId, targetWorkerName),
    webhookProvisioned(config)
      ? context.cloudflare.queueByName(accountId, config.webhooks!.queueName)
      : Promise.resolve(null),
    webhookProvisioned(config)
      ? context.cloudflare.queueMetrics(accountId, config.webhooks!.queueName)
      : Promise.resolve(null),
    context.cloudflare.workerExists(accountId, targetWorkerName)
      .then((exists) => exists
        ? context.cloudflare.workerSchedules(accountId, targetWorkerName)
        : []),
  ]);
  const queueExists = Boolean(queue);
  const queueConsumers = queue
    ? await context.cloudflare.queueConsumers(accountId, queue.id)
    : [];

  if (webhookProvisioned(config) && !queue &&
    !config.completedSteps.includes(DESTROY_QUEUE_STEP)) {
    throw new Error(
      `Webhook Queue \`${config.webhooks!.queueName}\` is missing. No ` +
        "resources were deleted because microfeed cannot verify the saved " +
        "environment's complete destruction target.",
    );
  }

  if (
    queue && config.webhooks?.queueId && queue.id !== config.webhooks.queueId
  ) {
    throw new Error(
      `Webhook Queue \`${config.webhooks.queueName}\` now has ID ${queue.id}, ` +
        `but this instance owns ${config.webhooks.queueId}. No resources ` +
        "were deleted.",
    );
  }
  if (config.completedSteps.includes(DESTROY_CONSUMER_STEP) &&
    queueConsumers.length > 0) {
    throw new Error(
      `Webhook Queue \`${config.webhooks?.queueName}\` has a consumer after ` +
        "an earlier destroy run recorded its consumer as detached. " +
        "microfeed will not delete the replacement consumer.",
    );
  }
  if (!config.completedSteps.includes(DESTROY_CONSUMER_STEP)) {
    verifiedWebhookQueueConsumers(queueConsumers, targetWorkerName);
  }

  if (config.completedSteps.includes(DESTROY_WORKER_STEP) && workerExists) {
    throw new Error(
      `Worker \`${targetWorkerName}\` exists again after an earlier destroy ` +
        "run deleted it. It may be a replacement resource, so microfeed " +
        "will not delete it. Inspect it in the Cloudflare dashboard.",
    );
  }
  if (config.completedSteps.includes(DESTROY_R2_STEP) && r2Exists) {
    throw new Error(
      `R2 bucket \`${config.r2.name}\` exists again after an earlier destroy ` +
        "run deleted it. Bucket names can be reused, so microfeed will not " +
        "delete this replacement bucket.",
    );
  }
  if (config.completedSteps.includes(DESTROY_QUEUE_STEP) && queueExists) {
    throw new Error(
      `Webhook Queue \`${config.webhooks?.queueName}\` exists again after ` +
        "an earlier destroy run deleted it. microfeed will not delete the " +
        "replacement Queue.",
    );
  }
  if (config.completedSteps.includes(DESTROY_CRON_STEP) &&
    schedules.length > 0) {
    throw new Error(
      `Worker \`${targetWorkerName}\` has Cron schedules after an earlier ` +
        "destroy run recorded them as removed. microfeed will not continue " +
        "until the replacement or drift is inspected.",
    );
  }

  const databaseById = databases.find(({id}) => id === config.d1.id);
  const databaseByName = databases.find(({name}) => name === config.d1.name);
  if (databaseById && databaseById.name !== config.d1.name) {
    throw new Error(
      `Saved D1 database ID ${config.d1.id} now has the unexpected name ` +
        `\`${databaseById.name}\`. No resources were deleted.`,
    );
  }
  if (databaseByName && databaseByName.id !== config.d1.id) {
    throw new Error(
      `D1 name \`${config.d1.name}\` now belongs to a different database ` +
        `(${databaseByName.id}). No resources were deleted.`,
    );
  }
  const d1Exists = Boolean(databaseById && databaseByName);
  if (config.completedSteps.includes(DESTROY_D1_STEP) && d1Exists) {
    throw new Error(
      `D1 database \`${config.d1.name}\` exists after an earlier destroy ` +
        "run recorded it as deleted. No resources were deleted.",
    );
  }

  const expectedDomains = config.customDomain ? [config.customDomain] : [];
  const actualDomains = domains.map(({hostname}) => hostname);
  const normalizedExpectedDomains = normalizedHostnames(expectedDomains);
  const hasUnexpectedDomain = normalizedHostnames(actualDomains).some(
    (hostname) => !normalizedExpectedDomains.includes(hostname),
  );
  const domainConfigurationMatches = !hasUnexpectedDomain &&
    (
      !workerExists ||
      sameHostnames(expectedDomains, actualDomains)
    );
  if (!domainConfigurationMatches) {
    throw new Error(
      `Worker \`${targetWorkerName}\` has an unexpected custom-domain ` +
        `configuration. Saved: ${expectedDomains.join(", ") || "none"}. ` +
        `Cloudflare: ${actualDomains.join(", ") || "none"}. No resources ` +
        "were deleted. Inspect Domains & Routes in the Worker dashboard first.",
    );
  }

  if (workerExists) {
    const discovered = (await context.cloudflare.discoverMicrofeedWorkers(
      account,
    )).find(({workerName: name}) => name === targetWorkerName);
    if (
      !discovered ||
      discovered.instanceId !== config.instanceId ||
      discovered.d1.id !== config.d1.id ||
      discovered.d1.name !== config.d1.name ||
      discovered.r2Name !== config.r2.name ||
      discovered.r2Ready !== isR2Ready(config) ||
      discovered.r2SetupMode !== config.r2.setupMode ||
      discovered.webhookQueueName !== (
        webhookProvisioned(config) ? config.webhooks!.queueName : undefined
      ) ||
      (discovered.webhookState ?? "unprovisioned") !== webhookState(config) ||
      (
        discovered.webhookQueueId !== undefined &&
        config.webhooks?.queueId !== undefined &&
        discovered.webhookQueueId !== config.webhooks.queueId
      )
    ) {
      throw new Error(
        `Worker \`${targetWorkerName}\` no longer matches this saved ` +
          "microfeed installation. No resources were deleted. Inspect its " +
          "bindings and MICROFEED_INSTANCE_ID in the Worker dashboard.",
      );
    }
  }

  return {
    d1Exists,
    domains,
    queue,
    queueConsumers,
    queueExists,
    queueMetrics,
    r2Exists,
    schedules,
    workerExists,
  };
}

function destroyResourcePlan(
  account: Account,
  config: MicrofeedConfig,
  inspection: DestroyInspection,
  keepData: boolean,
  preview: boolean,
): string {
  const d1Action = config.d1.reuse
    ? "PRESERVE (shared/reused resource)"
    : keepData
      ? "PRESERVE (--keep-data)"
      : inspection.d1Exists
        ? "DELETE permanently"
        : "Already absent";
  const r2Action = !isR2Ready(config)
    ? `Not configured (${config.r2.setupMode})`
    : config.r2.reuse
      ? "PRESERVE (shared/reused resource)"
      : keepData
        ? "PRESERVE (--keep-data)"
        : inspection.r2Exists
          ? "EMPTY and DELETE permanently"
          : "Already absent";
  const publicUrl = config.customDomain
    ? `https://${config.customDomain}`
    : config.deploymentUrl ?? "not recorded";
  return [
    `Site: ${config.instanceName}`,
    `Environment: ${preview ? "preview" : "production"}`,
    `Cloudflare account: ${account.name} (${account.id})`,
    `Public address: ${publicUrl}`,
    `Hosted application: ${workerName(config)} — ${
      inspection.workerExists ? "DELETE" : "Already absent"
    }`,
    `Custom address: ${
      config.customDomain ?? "none"
    } — ${inspection.domains.length > 0 ? "DETACH" : "Already absent"}`,
    `Content database: ${config.d1.name} (${config.d1.id}) — ${d1Action}`,
    `Media storage: ${config.r2.name} — ${r2Action}`,
    ...(webhookProvisioned(config)
      ? [
          `Webhook state: ${webhookState(config)}`,
          `Webhook Queue: ${config.webhooks!.queueName} ` +
            `(${config.webhooks!.queueId ?? inspection.queue?.id ?? "ID unavailable"}) — ` +
            `${inspection.queueExists ? "DELETE" : "Already absent"}`,
          `Webhook Queue ownership: dedicated to this ${preview ? "preview" : "production"} environment`,
          `Webhook Queue consumer: ${inspection.queueConsumers.length > 0
            ? `${inspection.queueConsumers[0]!.scriptName} ` +
              `(${inspection.queueConsumers[0]!.id}) — REMOVE`
            : "none"}`,
          `Webhook Queue backlog: ${inspection.queueMetrics
            ? `${inspection.queueMetrics.backlogCount} messages / ${inspection.queueMetrics.backlogBytes} bytes`
            : "unavailable"}`,
          `Webhook Cron schedules: ${inspection.schedules.length > 0
            ? `${inspection.schedules.join(", ")} — REMOVE`
            : "none"}`,
        ]
      : ["Webhook Queue: not configured"]),
    "Local instance folder: DELETE only after Cloudflare verification passes " +
      "(saved configuration and separate local development data)",
  ].join("\n");
}

function destroyInspectionLinks(
  accountId: string,
  config: MicrofeedConfig,
  inspection: DestroyInspection,
  keepData: boolean,
): string {
  const d1Expected = !inspection.d1Exists
    ? "already absent"
    : config.d1.reuse || keepData
      ? "still listed because it is being preserved"
      : "not listed";
  const r2Expected = !inspection.r2Exists
    ? "already absent"
    : config.r2.reuse || keepData
      ? "still listed because it is being preserved"
      : "not listed";
  return [
    [
      "Hosted applications (Workers & Pages)",
      `  Look for: ${workerName(config)}`,
      `  Expected after removal: ${
        inspection.workerExists ? "not listed" : "already absent"
      }`,
      `  ${workersAndPagesDashboardUrl(accountId)}`,
    ].join("\n"),
    [
      "Content databases (D1)",
      `  Look for: ${config.d1.name} (${config.d1.id})`,
      `  Expected after removal: ${d1Expected}`,
      `  ${d1DashboardUrl(accountId)}`,
    ].join("\n"),
    [
      "Media storage (R2)",
      `  Look for: ${config.r2.name}`,
      `  Expected after removal: ${r2Expected}`,
      `  ${r2OverviewDashboardUrl(accountId)}`,
    ].join("\n"),
    ...(webhookProvisioned(config)
      ? [[
          "Webhook Queues",
          `  Look for: ${config.webhooks!.queueName} ` +
            `(${config.webhooks!.queueId ?? inspection.queue?.id ?? "ID unavailable"})`,
          `  Expected after removal: ${
            !inspection.queueExists
              ? "already absent"
              : "not listed"
          }`,
          `  ${queuesDashboardUrl(accountId)}`,
        ].join("\n")]
      : []),
  ].join("\n\n");
}

async function recordDestroyStep(
  config: MicrofeedConfig,
  step: string,
): Promise<void> {
  markStep(config, step);
  await writeConfig(config);
}

async function confirmedDestroy(
  flags: Flags,
  config: MicrofeedConfig,
): Promise<boolean> {
  const suppliedConfirmation = flagString(flags, "confirm");
  if (suppliedConfirmation !== undefined) {
    if (suppliedConfirmation !== config.instanceName) {
      throw new Error(
        `--confirm must exactly match the site name ${config.instanceName}. ` +
          "No resources were deleted.",
      );
    }
    return true;
  }
  const reviewed = await askConfirm(
    "Have you reviewed the resource list and dashboard links above?",
    false,
  );
  if (!reviewed) {
    prompts.outro("Destroy cancelled. No Cloudflare resources were changed.");
    return false;
  }
  const typed = await askText(
    `Type ${config.instanceName} to permanently destroy this deployment`,
  );
  if (typed !== config.instanceName) {
    throw new Error(
      `Confirmation did not exactly match ${config.instanceName}. ` +
        "No resources were deleted.",
    );
  }
  return true;
}

export async function destroyCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  if (flagBoolean(flags, "local")) {
    throw new Error(
      "Cloudflare destroy does not accept --local. Remove a local-only " +
        "sandbox separately after backing up anything you want to keep.",
    );
  }
  if (flagBoolean(flags, "yes")) {
    throw new Error(
      "yarn manage destroy does not accept --yes. Use the interactive typed " +
        "confirmation, or pass --confirm <site-name> after reviewing a " +
        "--dry-run plan.",
    );
  }
  if (flagBoolean(flags, "dry-run") && flags.confirm !== undefined) {
    throw new Error(
      "--dry-run cannot be combined with --confirm; a dry run never " +
        "deletes resources.",
    );
  }

  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const preview = flagBoolean(flags, "preview");
  const keepData = flagBoolean(flags, "keep-data");
  await resolveCommandInstance(context);
  const config = await readConfig(preview, context.instanceName);
  if (!config || isLocalOnly(config)) {
    throw new Error(
      `No saved Cloudflare ${preview ? "preview " : ""}deployment was ` +
        `found for site ${context.instanceName ?? "unknown"}.`,
    );
  }
  if (webhookProvisioned(config)) {
    context.cloudflare = new CloudflareClient(runner, ["queues:write"]);
  }
  if (!preview && await readConfig(true, config.instanceName)) {
    throw new Error(
      `Site ${config.instanceName} still has a preview deployment. ` +
        "Destroy it first with yarn manage destroy --preview --instance " +
        config.instanceName +
        " so shared media storage cannot be deleted while preview uses it.",
    );
  }

  const accountId = cloudflareAccountId(config);
  const account = await authenticate(context, accountId);
  const inspection = await inspectDestroyTarget(context, account, config);
  prompts.intro(
    `Destroy microfeed ${preview ? "preview" : "deployment"}: ` +
      config.instanceName,
  );
  prompts.note(
    destroyResourcePlan(account, config, inspection, keepData, preview),
    "Permanent deletion plan",
  );
  process.stdout.write(
    "\nCloudflare inspection links\n" +
      "These are account-wide lists. Use the exact names below to inspect " +
      "the resources before deletion and confirm the expected result after " +
      "the command finishes.\n\n" +
      `${destroyInspectionLinks(
        accountId,
        config,
        inspection,
        keepData,
      )}\n\n`,
  );
  prompts.note(
    "Export anything you need before continuing. Content database and " +
      "media deletion cannot be undone. The separate local development " +
      "sandbox will also be deleted. Reused Cloudflare resources are always " +
      "preserved. This command does not inspect or change Cloudflare Zero " +
      "Trust or SSL settings.",
    "Safety guardrails",
  );

  if (flagBoolean(flags, "dry-run")) {
    prompts.outro(
      "Dry run complete. No Cloudflare or local resources were changed. " +
        `After inspection, run again with --confirm ${config.instanceName}.`,
    );
    return;
  }
  if (!await confirmedDestroy(flags, config)) {
    return;
  }

  const targetWorkerName = workerName(config);
  if (webhookProvisioned(config)) {
    if (inspection.queue) {
      const queue = await verifiedWebhookQueue(context, config);
      if (!queue.deliveryPaused) {
        await context.cloudflare.pauseQueue(accountId, queue.name);
      }
      const pausedQueue = await context.cloudflare.queueByName(
        accountId,
        queue.name,
      );
      if (!pausedQueue || pausedQueue.id !== queue.id ||
        !pausedQueue.deliveryPaused) {
        throw new Error(
          `Webhook Queue ${queue.name} could not be verified as paused. ` +
            "No Worker or data resource was deleted.",
        );
      }
      prompts.log.success(`Webhook Queue ${queue.name}: paused`);
    }

    if (inspection.workerExists && inspection.schedules.length > 0) {
      await context.cloudflare.replaceWorkerSchedules(
        accountId,
        targetWorkerName,
        [],
      );
    }
    const remainingSchedules = inspection.workerExists
      ? await context.cloudflare.workerSchedules(accountId, targetWorkerName)
      : [];
    if (remainingSchedules.length > 0) {
      throw new Error(
        `Cloudflare still reports Cron schedules for ${targetWorkerName}. ` +
          "No Worker or data resource was deleted.",
      );
    }
    await recordDestroyStep(config, DESTROY_CRON_STEP);
    prompts.log.success("Webhook Cron schedules: removed");

    let detachedConsumers = 0;
    if (inspection.queue) {
      const queue = await verifiedWebhookQueue(context, config);
      const consumers = await context.cloudflare.queueConsumers(
        accountId,
        queue.id,
      );
      const expectedConsumers = verifiedWebhookQueueConsumers(
        consumers,
        targetWorkerName,
      );
      for (const consumer of expectedConsumers) {
        await context.cloudflare.deleteQueueConsumer(
          accountId,
          queue.id,
          consumer.id,
        );
        detachedConsumers += 1;
      }
      const remainingConsumers = await context.cloudflare.queueConsumers(
        accountId,
        queue.id,
      );
      if (remainingConsumers.length > 0) {
        throw new Error(
          `Cloudflare still reports a consumer for webhook Queue ` +
            `${queue.name}. No Worker or data resource was deleted.`,
        );
      }
    }
    await recordDestroyStep(config, DESTROY_CONSUMER_STEP);
    prompts.log.success(
      detachedConsumers > 0
        ? "Webhook Queue consumer: detached"
        : "Webhook Queue consumer: already absent",
    );

    if ((keepData || config.d1.reuse) && inspection.d1Exists) {
      await context.cloudflare.queryD1(
        config,
        WEBHOOK_DESTROY_CANCEL_PENDING_SQL,
      );
      prompts.log.success("Pending webhook deliveries: canceled");
    }
  }

  if (inspection.workerExists) {
    try {
      await context.cloudflare.deleteWorker(accountId, targetWorkerName);
    } catch (error) {
      throw new Error(
        "Cloudflare refused to delete hosted application " +
          `${targetWorkerName}. It may be used by another Worker. ` +
          `Inspect ${workerDashboardUrl(accountId, targetWorkerName)}. ` +
          `No database or media storage was deleted. ${errorMessage(error)}`,
      );
    }
    if (await context.cloudflare.workerExists(accountId, targetWorkerName)) {
      throw new Error(
        `Cloudflare still reports hosted application ${targetWorkerName} ` +
          "after deletion. No database or media storage was deleted. Inspect " +
          workerDashboardUrl(accountId, targetWorkerName),
      );
    }
    prompts.log.success(`Hosted application ${targetWorkerName}: deleted`);
  } else {
    prompts.log.info(`Hosted application ${targetWorkerName}: already absent`);
  }
  await recordDestroyStep(config, DESTROY_WORKER_STEP);

  const remainingDomains = await context.cloudflare.workerDomains(
    accountId,
    targetWorkerName,
  );
  for (const domain of remainingDomains) {
    await context.cloudflare.deleteWorkerDomain(accountId, domain.id);
  }
  const domainsAfterDelete = await context.cloudflare.workerDomains(
    accountId,
    targetWorkerName,
  );
  if (domainsAfterDelete.length > 0) {
    throw new Error(
      `Cloudflare still reports custom address ${
        domainsAfterDelete.map(({hostname}) => hostname).join(", ")
      }. No data storage was deleted. Inspect ` +
        workerDashboardUrl(accountId, targetWorkerName),
    );
  }
  await recordDestroyStep(config, DESTROY_DOMAINS_STEP);
  if (inspection.domains.length > 0) {
    prompts.log.success("Custom address: detached");
  }

  if (webhookProvisioned(config)) {
    const queueName = config.webhooks!.queueName;
    const expectedQueueId = config.webhooks!.queueId ?? inspection.queue?.id;
    const currentQueue = await context.cloudflare.queueByName(
      accountId,
      queueName,
    );
    if (currentQueue && (!expectedQueueId || currentQueue.id !== expectedQueueId)) {
      throw new Error(
        `Webhook Queue ${queueName} changed after the deletion plan was ` +
          "inspected. It was not deleted. Rerun --dry-run.",
      );
    }
    if (currentQueue) {
      await context.cloudflare.deleteQueue(accountId, queueName);
      if (await context.cloudflare.queueByName(accountId, queueName)) {
        throw new Error(
          `Webhook Queue ${queueName} still exists after deletion. ` +
            `Inspect ${queuesDashboardUrl(accountId)}.`,
        );
      }
      prompts.log.success(`Webhook Queue ${queueName}: deleted`);
    } else {
      prompts.log.info(`Webhook Queue ${queueName}: already absent`);
    }
    await recordDestroyStep(config, DESTROY_QUEUE_STEP);
  }

  if (!config.d1.reuse && !keepData && inspection.d1Exists) {
    const currentDatabases = await context.cloudflare.d1Databases(accountId);
    const currentDatabase = currentDatabases.find(
      ({name}) => name === config.d1.name,
    );
    if (!currentDatabase || currentDatabase.id !== config.d1.id) {
      throw new Error(
        `Content database ${config.d1.name} changed after the deletion plan ` +
          "was inspected. It was not deleted. Rerun --dry-run and inspect " +
          `${d1DashboardUrl(accountId)}.`,
      );
    }
    await context.cloudflare.deleteD1(accountId, config.d1.id);
    const remainingDatabases = await context.cloudflare.d1Databases(accountId);
    if (remainingDatabases.some(({id}) => id === config.d1.id)) {
      throw new Error(
        `D1 database ${config.d1.name} still exists after deletion. ` +
          `Media storage was not deleted. Inspect ${d1DashboardUrl(accountId)}.`,
      );
    }
    await recordDestroyStep(config, DESTROY_D1_STEP);
    prompts.log.success(`Content database ${config.d1.name}: deleted`);
  } else {
    prompts.log.info(
      `Content database ${config.d1.name}: ${
        inspection.d1Exists ? "preserved" : "already absent"
      }`,
    );
  }

  if (!config.r2.reuse && !keepData && inspection.r2Exists) {
    let deletedObjects: number;
    try {
      deletedObjects = await context.cloudflare.emptyR2Bucket(
        accountId,
        config.r2.name,
      );
      await context.cloudflare.deleteR2Bucket(accountId, config.r2.name);
    } catch (error) {
      throw new Error(
        `Media storage ${config.r2.name} could not be fully removed. ` +
          "Some objects may already have been permanently deleted. Rerun " +
          `the same command to resume, or inspect ${
            r2DashboardUrl(accountId, config.r2.name)
          }. ${errorMessage(error)}`,
      );
    }
    if (await context.cloudflare.r2BucketExists(accountId, config.r2.name)) {
      throw new Error(
        `R2 bucket ${config.r2.name} still exists after deletion. ` +
          `Rerun the command or inspect ${
            r2DashboardUrl(accountId, config.r2.name)
          }.`,
      );
    }
    await recordDestroyStep(config, DESTROY_R2_STEP);
    prompts.log.success(
      `Media storage ${config.r2.name}: deleted (${deletedObjects} objects)`,
    );
  } else {
    prompts.log.info(
      `Media storage ${config.r2.name}: ${
        inspection.r2Exists ? "preserved" : "already absent"
      }`,
    );
  }

  await removeSavedInstance(config.instanceName, preview);
  prompts.log.success(
    "Local instance folder: deleted (configuration and local development data)",
  );

  process.stdout.write(
    "\nConfirm the result in Cloudflare\n" +
      "Cloudflare's lists may take a moment to refresh. Open each page and " +
      "check the exact name and expected result shown below.\n\n" +
      `${destroyInspectionLinks(
        accountId,
        config,
        inspection,
        keepData,
      )}\n\n`,
  );
  prompts.outro(
    `Cloudflare ${preview ? "preview " : ""}deployment removed. ` +
      (keepData || config.d1.reuse || config.r2.reuse
        ? "The resource list above identifies preserved data."
        : "Hosted application, content database, and media storage are gone."),
  );
}

const AUTH_ACTION_LABELS: Record<string, string> = {
  "change-email": "Change dashboard sign-in email",
  "change-path": "Change dashboard path",
  disable: "Disable built-in dashboard login",
  "reset-password": "Reset dashboard password",
  setup: "Set up dashboard login",
};

export function authTargetNotice(
  config: MicrofeedConfig,
  action: string,
  local: boolean,
  preview: boolean,
): {message: string; title: string} {
  const dashboardPath = adminBasePath(config.adminPath);
  const lines = [
    `Instance: ${config.instanceName}`,
    `Target: ${
      local
        ? isLocalOnly(config)
          ? "Local instance"
          : "Local development sandbox"
        : preview
          ? "Cloudflare preview"
          : "Cloudflare production"
    }`,
  ];
  if (local) {
    lines.push(`Dashboard path: ${dashboardPath}`);
  } else {
    lines.push(`Worker: ${workerName(config)}`);
    const publicUrl = deploymentVerificationUrl(config);
    lines.push(
      publicUrl
        ? `Dashboard: ${new URL(dashboardPath, publicUrl).href}`
        : `Dashboard path: ${dashboardPath} (not deployed yet)`,
    );
  }
  lines.push(`Action: ${AUTH_ACTION_LABELS[action] ?? action}`);
  return {
    message: lines.join("\n"),
    title: "Dashboard login target",
  };
}

export async function authCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const requestedAction = flagString(flags, "action");
  if (!requestedAction) {
    process.stdout.write(renderCliHelp("auth"));
    return;
  }
  const supportedActions = new Set([
    "change-email",
    "change-path",
    "disable",
    "reset-password",
    "setup",
  ]);
  if (!supportedActions.has(requestedAction)) {
    throw new Error(`Unknown auth action: ${requestedAction}`);
  }
  if (
    flags["admin-password"] !== undefined &&
    requestedAction !== "setup" &&
    requestedAction !== "reset-password"
  ) {
    throw new Error(
      "`--admin-password` is supported only by `auth setup` and " +
        "`auth reset-password`.",
    );
  }
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const requestedLocal = flagBoolean(flags, "local");
  const preview = flagBoolean(flags, "preview");
  await resolveCommandInstance(context, requestedLocal);
  const savedConfig = context.instanceName
    ? await readConfig(false, context.instanceName)
    : null;
  const inferredLocal = savedConfig !== null && isLocalOnly(savedConfig);
  if (preview && inferredLocal) {
    throw new Error(
      `Instance \`${savedConfig.instanceName}\` is local only and has no ` +
        "preview environment. Remove `--preview` or select a Cloudflare " +
        "instance.",
    );
  }
  if (preview && requestedLocal) {
    throw new Error("`--local` and `--preview` cannot be used together.");
  }
  const local = requestedLocal || inferredLocal;
  const config = await ensureWranglerConfig(
    local,
    preview,
    context.instanceName,
  );
  if (local) {
    const action = requestedAction;
    if (flags["admin-password"] !== undefined) {
      throw new Error(
        "`--admin-password` is not supported for local instances. Run the " +
        "local password setup or reset interactively so the password stays " +
        "hidden.",
      );
    }
    validateUnsafeAdminPasswordFlag(flags);
    if (
      !["change-email", "disable", "reset-password", "setup"].includes(
        action,
      )
    ) {
      throw new Error(
        "Local authentication supports setup, change-email, reset-password, " +
        "and disabling login for local-only instances. Changing the " +
        "dashboard path requires a Cloudflare instance.",
      );
    }
    prompts.intro("microfeed dashboard login");
    const target = authTargetNotice(config, action, true, false);
    prompts.note(target.message, target.title);
    if (action === "disable") {
      if (!isLocalOnly(config)) {
        throw new Error(
          "A Cloudflare-connected site's local sandbox cannot override the " +
          "saved production authentication mode. Run the command without " +
          "`--local` to update Cloudflare, or use a local-only instance.",
        );
      }
      if (adminAuthMode(config) === "none") {
        prompts.outro("The built-in dashboard login is already disabled.");
        return;
      }
      const adminDashboardUrl = new URL(
        adminBasePath(config.adminPath),
        config.deploymentUrl ?? "http://localhost:4321",
      ).href;
      const notice = localAdminAuthDisableNotice(
        adminDashboardUrl,
        config.instanceName,
      );
      prompts.note(notice.message, notice.title);
      if (
        !flagBoolean(flags, "yes") &&
        !await askConfirm(notice.confirmation, false)
      ) {
        throw new Error("Built-in authentication was not changed.");
      }
      await context.cloudflare.applyLocalMigrations(config);
      const owner = await context.cloudflare.authOwner(config, true);
      if (owner) {
        await withEphemeralSqlFile(
          revokeOwnerOAuthSql(owner),
          (filename) =>
            context.cloudflare.executeAuthSql(config, filename, true),
        );
      }
      await updateAdminAuthMode(config, "none", {
        apply: generateWranglerConfig,
        generate: generateWranglerConfig,
        write: writeConfig,
      });
      prompts.outro(
        "Built-in login disabled for this local instance. Restart " +
        `\`yarn dev --instance ${config.instanceName}\` if it is running.`,
      );
      return;
    }
    await context.cloudflare.applyLocalMigrations(config);
    if (action === "setup") {
      const owner = await ensureAuthOwner(context, config, true);
      if (adminAuthMode(config) === "none") {
        config.adminAuthMode = "built-in";
        await writeConfig(config);
        await generateWranglerConfig(config);
      }
      prompts.outro(`Local dashboard login ready for ${owner.email}.`);
      return;
    }
    const owner = await context.cloudflare.authOwner(config, true);
    if (!owner) {
      throw new Error(
        "No local dashboard login exists. Run " +
          `\`yarn manage auth setup --instance ${config.instanceName}\` ` +
          "first.",
      );
    }
    if (action === "reset-password") {
      const password = await promptForPassword(
        "New dashboard login password",
      );
      await withEphemeralSqlFile(
        `${await passwordResetSql(owner, password)}\n${
          clearPasswordSetupSql()
        }`,
        (filename) =>
          context.cloudflare.executeAuthSql(config, filename, true),
      );
      prompts.outro(
        "Local dashboard password updated. Existing admin sessions were " +
          "signed out.",
      );
      return;
    }
    const emailInput = flagString(flags, "owner-email") ??
      await askText("New dashboard login email", owner.email);
    const error = validateOwnerEmail(emailInput);
    if (error) {
      throw new Error(error);
    }
    await withEphemeralSqlFile(
      ownerEmailUpdateSql(owner, emailInput),
      (filename) => context.cloudflare.executeAuthSql(config, filename, true),
    );
    prompts.outro(
      `Local dashboard login email changed to ${
        normalizeOwnerEmail(emailInput)
      }. Existing admin sessions were signed out.`,
    );
    return;
  }
  validateUnsafeAdminPasswordFlag(flags);
  const accountId = cloudflareAccountId(config);

  prompts.intro(
    `microfeed ${preview ? "preview " : ""}dashboard login`,
  );
  const target = authTargetNotice(config, requestedAction, false, preview);
  prompts.note(target.message, target.title);
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  const action = requestedAction;
  if (action === "disable") {
    if (adminAuthMode(config) === "none") {
      prompts.outro("The built-in dashboard login is already disabled.");
      return;
    }
    const verificationUrl = deploymentVerificationUrl(config);
    if (!verificationUrl) {
      throw new Error(
        "Deploy microfeed before disabling the built-in dashboard login.",
      );
    }
    const adminDashboardUrl = new URL(
      adminBasePath(config.adminPath),
      verificationUrl,
    ).href;
    const protection = await anonymousAdminProtection(
      verificationUrl,
      config.adminPath,
      context.runner,
    );
    const notice = adminAuthDisableNotice(
      protection,
      adminDashboardUrl,
    );
    prompts.note(notice.message, notice.title);
    if (
      !flagBoolean(flags, "yes") &&
      !await askConfirm(notice.confirmation, false)
    ) {
      throw new Error(
        "Built-in authentication was not changed.",
      );
    }
    await context.cloudflare.applyMigrations(config);
    const owner = await context.cloudflare.authOwner(config);
    if (owner) {
      await withEphemeralSqlFile(
        revokeOwnerOAuthSql(owner),
        (filename) => context.cloudflare.executeAuthSql(config, filename),
      );
    }
    await redeployWithAdminAuthMode(
      config,
      "none",
      {
        deploy: async (nextConfig) => {
          await deployConfiguredProject(context, nextConfig, false);
        },
        generate: generateWranglerConfig,
        write: writeConfig,
      },
    );
    prompts.outro(
      protection === "access"
        ? "Built-in login disabled. Cloudflare Access continues to protect " +
          `${adminDashboardUrl}`
        : "Built-in login disabled. The admin dashboard is now public at " +
          adminDashboardUrl,
    );
    return;
  }
  if (action === "setup") {
    if (adminAuthMode(config) !== "built-in") {
      await redeployWithAdminAuthMode(
        config,
        "built-in",
        {
          deploy: async (nextConfig) => {
            await deployConfiguredProject(context, nextConfig, false, true);
          },
          generate: generateWranglerConfig,
          write: writeConfig,
        },
      );
    } else {
      await context.cloudflare.applyMigrations(config);
    }
    await finishInitialAdminSetup(context, config);
    prompts.outro(
      await context.cloudflare.authOwner(config)
        ? "Dashboard login is ready."
        : "Open the private link to create the dashboard password.",
    );
    return;
  }
  await context.cloudflare.applyMigrations(config);
  const owner = await context.cloudflare.authOwner(config);
  if (!owner) {
    throw new Error(
      "No owner login exists. Run `yarn manage auth setup` first.",
    );
  }

  if (action === "reset-password") {
    const password = unsafeAdminPassword(flags);
    if (password !== undefined) {
      await withEphemeralSqlFile(
        `${await passwordResetSql(owner, password)}\n${
          clearPasswordSetupSql()
        }`,
        (filename) => context.cloudflare.executeAuthSql(config, filename),
      );
      prompts.outro(
        "Password updated. Existing admin sessions were signed out.",
      );
      return;
    }
    await issuePasswordSetupLink(context, config, {
      email: owner.email,
      purpose: "reset",
      userId: owner.id,
    });
    prompts.outro(
      "Open the private link to choose a new password. The current password " +
        "continues to work until the link is completed.",
    );
    return;
  }

  if (action === "change-email") {
    const emailInput = flagString(flags, "owner-email") ??
      await askText("New owner email", owner.email);
    const error = validateOwnerEmail(emailInput);
    if (error) {
      throw new Error(error);
    }
    await withEphemeralSqlFile(
      ownerEmailUpdateSql(owner, emailInput),
      (filename) => context.cloudflare.executeAuthSql(config, filename),
    );
    prompts.outro(
      `Owner email changed to ${normalizeOwnerEmail(emailInput)}. ` +
      "Existing admin sessions were signed out.",
    );
    return;
  }

  const previous = structuredClone(config);
  const nextAdminPath = await configuredAdminPath(flags, config.adminPath);
  if (nextAdminPath === config.adminPath) {
    prompts.outro("The dashboard path is unchanged.");
    return;
  }
  config.adminPath = nextAdminPath;
  await writeConfig(config);
  try {
    await deployConfiguredProject(context, config, false);
  } catch (error) {
    await writeConfig(previous);
    await generateWranglerConfig(previous);
    throw error;
  }
  prompts.outro(
    `Dashboard login moved to ${adminBasePath(config.adminPath)}. ` +
    `${adminBasePath(previous.adminPath)} now returns 404.`,
  );
}

export async function configCommand(flags: Flags): Promise<void> {
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runCommand),
    flags,
    instanceName: undefined,
    runner: runCommand,
  };
  await resolveCommandInstance(context, flagBoolean(flags, "local"));
  await ensureWranglerConfig(
    flagBoolean(flags, "local"),
    flagBoolean(flags, "preview"),
    context.instanceName,
  );
}

function managedCloudflareKey(
  accountId: string,
  worker: string,
): string {
  return `${accountId}\u0000${worker}`;
}

function connectedInstanceLines(
  active: boolean,
  config: MicrofeedConfig,
  name: string,
): string[] {
  const type = isLocalOnly(config)
    ? "Local only"
    : "Cloudflare — managed here";
  return [
    `${active ? "●" : "○"} ${name}${active ? " (active)" : ""}`,
    `    Type: ${type}`,
    ...(isLocalOnly(config)
      ? [
          `    D1: ${config.d1.name} (local simulation)`,
          `    R2: ${config.r2.name} (${isR2Ready(config)
            ? "local simulation"
            : "disabled"})`,
          `    URL: ${config.deploymentUrl ?? "http://localhost:4321"}`,
        ]
      : [
          `    Worker: ${workerName(config)}`,
          `    D1: ${config.d1.name}`,
          `    R2: ${config.r2.name} (${isR2Ready(config)
            ? "ready"
            : config.r2.setupMode === "disabled"
              ? "disabled"
              : "subscription pending"})`,
          `    URL: ${
            config.customDomain
              ? `https://${config.customDomain}`
              : config.deploymentUrl ?? "not deployed"
          }`,
        ]),
  ];
}

function availableInstanceLines(
  worker: DiscoveredMicrofeedWorker,
): string[] {
  const instanceName = normalizeLocalInstanceName(
    worker.deploymentEnvironment === "preview"
      ? worker.projectName
      : worker.workerName,
  );
  const url = worker.customDomains[0]
    ? `https://${worker.customDomains[0]}`
    : worker.workersDevUrl ?? "no public URL";
  return [
    `◇ ${worker.workerName}`,
    "    Type: Cloudflare — available to connect",
    `    D1: ${worker.d1.name}`,
    `    R2: ${worker.r2Name} (${worker.r2Ready
      ? "ready"
      : worker.r2SetupMode === "disabled"
        ? "disabled"
        : "subscription pending"})`,
    `    URL: ${url}`,
    "    Connect: " +
      `yarn manage connect ${
        worker.deploymentEnvironment === "preview" ? "--preview " : ""
      }--account-id ${worker.accountId} ` +
      `--worker ${worker.workerName} --instance ${instanceName}`,
  ];
}

async function discoverAcrossAccounts(
  context: CommandContext,
): Promise<{
  identity: CloudflareIdentity;
  messages: string[];
  workers: DiscoveredMicrofeedWorker[];
}> {
  const identity = await context.cloudflare.identity();
  const accounts = identity.accounts;
  if (accounts.length === 0) {
    return {
      identity,
      messages: [
        "Cloudflare discovery skipped because Wrangler is not signed in. " +
        "Run `yarn manage connect` to sign in and connect an existing Worker.",
      ],
      workers: [],
    };
  }
  const requestedAccountId = flagString(context.flags, "account-id");
  const selectedAccounts = requestedAccountId
    ? accounts.filter(({id}) => id === requestedAccountId)
    : accounts;
  if (requestedAccountId && selectedAccounts.length === 0) {
    return {
      identity,
      messages: [
        `Cloudflare account ${requestedAccountId} is not available to the ` +
          "current Wrangler login.",
      ],
      workers: [],
    };
  }
  const results = await Promise.allSettled(
    selectedAccounts.map((account) =>
      context.cloudflare.discoverMicrofeedWorkers(account)
    ),
  );
  const workers = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  const messages = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `Cloudflare discovery failed for ${
            selectedAccounts[index]?.name ?? "an account"
          }: ${errorMessage(result.reason)}`,
        ]
      : []
  );
  return {identity, messages, workers};
}

interface CloudflareInstanceGroup {
  accountId: string;
  accountName: string;
  available: DiscoveredMicrofeedWorker[];
  email: string | null;
  managed: Array<{
    active: boolean;
    config: MicrofeedConfig;
    name: string;
  }>;
  profile: string | null;
}

function instanceRecordLines(records: string[][]): string[] {
  return records.flatMap((record, index) =>
    index === 0 ? record : ["", ...record]
  );
}

function appendSection(lines: string[], section: string[]): void {
  if (lines.length > 0) {
    lines.push("");
  }
  lines.push(...section);
}

export async function instancesCommand(
  flags: Flags = {},
  runner: CommandRunner = runCommand,
): Promise<void> {
  const summaries = await instanceSummaries();
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const discovery = await discoverAcrossAccounts(context);
  const managed = new Set(
    summaries.flatMap(({config}) =>
      config.hosting === "cloudflare" && config.accountId
        ? [managedCloudflareKey(config.accountId, workerName(config))]
        : []
    ),
  );
  const available = discovery.workers.filter(
    (worker) =>
      !managed.has(
        managedCloudflareKey(worker.accountId, worker.workerName),
      ),
  );
  const local = summaries.filter(({config}) => isLocalOnly(config));
  const accountMetadata = new Map(
    discovery.identity.accounts.map((account) => [account.id, account]),
  );
  const groups = new Map<string, CloudflareInstanceGroup>();
  const ensureGroup = (
    accountId: string,
    fallbackName = accountId,
  ): CloudflareInstanceGroup => {
    const account = accountMetadata.get(accountId);
    const existing = groups.get(accountId);
    if (existing) {
      if (existing.accountName === accountId && fallbackName !== accountId) {
        existing.accountName = fallbackName;
      }
      return existing;
    }
    const isAvailableToCurrentLogin = Boolean(account);
    const group: CloudflareInstanceGroup = {
      accountId,
      accountName: account?.name ?? fallbackName,
      available: [],
      email: isAvailableToCurrentLogin ? discovery.identity.email : null,
      managed: [],
      profile: isAvailableToCurrentLogin
        ? discovery.identity.profile
        : null,
    };
    groups.set(accountId, group);
    return group;
  };
  for (const summary of summaries) {
    if (summary.config.hosting === "cloudflare" && summary.config.accountId) {
      ensureGroup(summary.config.accountId).managed.push(summary);
    }
  }
  for (const worker of available) {
    ensureGroup(worker.accountId, worker.accountName).available.push(worker);
  }

  const sortedGroups = [...groups.values()].sort((left, right) =>
    left.accountName.localeCompare(right.accountName) ||
    left.accountId.localeCompare(right.accountId)
  );
  const sortedLocal = local.sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  for (const group of sortedGroups) {
    group.managed.sort((left, right) => left.name.localeCompare(right.name));
    group.available.sort((left, right) =>
      left.workerName.localeCompare(right.workerName)
    );
  }
  if (flagBoolean(flags, "json")) {
    process.stdout.write(`${JSON.stringify({
      accounts: sortedGroups,
      local: sortedLocal,
      messages: discovery.messages,
    })}\n`);
    return;
  }

  const lines: string[] = [];
  appendSection(lines, [
    "=== Local ===",
    ...(sortedLocal.length > 0
      ? instanceRecordLines(sortedLocal.map(({active, config, name}) =>
          connectedInstanceLines(active, config, name)
        ))
      : ["No local-only instances."]),
  ]);
  for (const group of sortedGroups) {
    const records = [
      ...group.managed
        .map(({active, config, name}) =>
          connectedInstanceLines(active, config, name)
        ),
      ...group.available
        .map(availableInstanceLines),
    ];
    appendSection(lines, [
      `=== Cloudflare — ${group.accountName} ===`,
      ...(group.profile ? [`Wrangler profile: ${group.profile}`] : []),
      ...(group.email ? [`Wrangler login email: ${group.email}`] : []),
      `Account ID: ${group.accountId}`,
      "",
      ...instanceRecordLines(records),
    ]);
  }
  if (local.length === 0 && sortedGroups.length === 0) {
    appendSection(lines, [
      "No microfeed instances were found.",
      "Create a local instance with " +
        "`yarn manage init --local --instance <name>`.",
      "Create a Cloudflare deployment with " +
        "`yarn manage init --instance <name>`.",
    ]);
  }
  if (discovery.messages.length > 0) {
    lines.push("", ...discovery.messages);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function verifiedConnectionIdentity(
  worker: DiscoveredMicrofeedWorker,
  runner: CommandRunner,
): Promise<{baseUrl: string; instanceId: string}> {
  if (worker.customDomains.length > 1) {
    throw new Error(
      `Worker \`${worker.workerName}\` has multiple custom domains. ` +
        "microfeed cannot safely represent that routing configuration yet, " +
        "so it was not connected.",
    );
  }
  const urls = [
    ...worker.customDomains.map((hostname) => `https://${hostname}`),
    ...(worker.workersDevUrl ? [worker.workersDevUrl] : []),
  ];
  if (urls.length === 0) {
    throw new Error(
      `Worker \`${worker.workerName}\` has no public custom domain or ` +
        "workers.dev URL to verify.",
    );
  }
  const failures: string[] = [];
  for (const baseUrl of [...new Set(urls)]) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      DEPLOYMENT_VERIFICATION_TIMEOUT_MS,
    );
    try {
      const identity = await readMicrofeedIdentity(
        baseUrl,
        runner,
        controller.signal,
      );
      if (
        worker.instanceId &&
        worker.instanceId !== identity.instanceId
      ) {
        failures.push(`${baseUrl}: instance identity does not match`);
        continue;
      }
      return {baseUrl, instanceId: identity.instanceId};
    } catch (error) {
      failures.push(`${baseUrl}: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(
    `Worker \`${worker.workerName}\` could not be verified as microfeed.\n` +
      failures.join("\n"),
  );
}

export async function connectCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const preview = flagBoolean(flags, "preview");
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner, ["queues:write"]),
    flags,
    instanceName: undefined,
    runner,
  };
  prompts.intro(
    `Connect an existing Cloudflare microfeed${preview ? " preview" : ""}`,
  );
  const account = await authenticate(context);
  const workers = (await context.cloudflare.discoverMicrofeedWorkers(account))
    .filter(({deploymentEnvironment}) =>
      deploymentEnvironment === (preview ? "preview" : "production")
    );
  if (workers.length === 0) {
    throw new Error(
      `No compatible microfeed ${preview ? "preview " : "production "}` +
        "Workers were found in this Cloudflare account.",
    );
  }
  const requestedWorkerName = flagString(flags, "worker");
  let selectedWorker: DiscoveredMicrofeedWorker;
  if (requestedWorkerName) {
    const match = workers.find(
      ({workerName: name}) => name === requestedWorkerName,
    );
    if (!match) {
      throw new Error(
        `Compatible Worker \`${requestedWorkerName}\` was not found in ` +
          `Cloudflare account ${account.id}.`,
      );
    }
    selectedWorker = match;
  } else if (workers.length === 1) {
    selectedWorker = workers[0]!;
  } else {
    if (flagBoolean(flags, "yes")) {
      throw new Error(
        "Multiple compatible Workers were found. Pass `--worker <name>` " +
          "with `--yes`.",
      );
    }
    const selectedName = await chooseLocalInstance(
      workers.map(({workerName: name}) => name),
      "Which Cloudflare microfeed Worker should be connected?",
    );
    selectedWorker = workers.find(
      ({workerName: name}) => name === selectedName,
    )!;
  }

  const existingManaged = preview
    ? null
    : (await instanceSummaries()).find(
        ({config}) =>
          config.hosting === "cloudflare" &&
          config.accountId === selectedWorker.accountId &&
          workerName(config) === selectedWorker.workerName,
      );
  if (existingManaged) {
    await setActiveInstance(existingManaged.name);
    prompts.outro(
      `Worker \`${selectedWorker.workerName}\` is already managed as ` +
        `instance \`${existingManaged.name}\`; it is now active.`,
    );
    return;
  }

  const requestedInstanceName = flagString(flags, "instance") ??
    normalizeLocalInstanceName(selectedWorker.workerName);
  const nameError = validateLocalInstanceName(requestedInstanceName);
  if (nameError) {
    throw new Error(
      `Invalid instance name \`${requestedInstanceName}\`. ${nameError}`,
    );
  }
  const productionConfig = preview
    ? await readConfig(false, requestedInstanceName)
    : null;
  if (preview && !productionConfig) {
    throw new Error(
      `Connect production as instance \`${requestedInstanceName}\` first, ` +
        "then rerun this command with `--preview`.",
    );
  }
  if (
    preview &&
    (productionConfig!.accountId !== selectedWorker.accountId ||
      productionConfig!.projectName !== selectedWorker.projectName)
  ) {
    throw new Error(
      `Worker \`${selectedWorker.workerName}\` is not the preview environment ` +
        `for saved instance \`${requestedInstanceName}\`.`,
    );
  }
  const existingAtName = await readConfig(preview, requestedInstanceName);
  if (existingAtName) {
    if (
      existingAtName.accountId === selectedWorker.accountId &&
      workerName(existingAtName) === selectedWorker.workerName
    ) {
      await setActiveInstance(requestedInstanceName);
      prompts.outro(
        `Worker \`${selectedWorker.workerName}\` is already managed as ` +
          `${preview ? "preview for " : ""}instance ` +
          `\`${requestedInstanceName}\`; it is now active.`,
      );
      return;
    }
    throw new Error(
      `${preview ? "Preview for" : "Instance"} \`${requestedInstanceName}\` ` +
        "already exists and manages a different Worker.",
    );
  }

  const identity = await verifiedConnectionIdentity(selectedWorker, runner);
  const secretNames = await context.cloudflare.workerSecretNames(
    selectedWorker.accountId,
    selectedWorker.workerName,
  );
  const customDomain = selectedWorker.customDomains[0] ?? null;
  const queue = selectedWorker.webhookQueueName
    ? await context.cloudflare.queueByName(
        selectedWorker.accountId,
        selectedWorker.webhookQueueName,
      )
    : null;
  if (selectedWorker.webhookQueueName && !queue) {
    throw new Error(
      `Worker \`${selectedWorker.workerName}\` records webhook Queue ` +
        `\`${selectedWorker.webhookQueueName}\`, but that Queue was not found.`,
    );
  }
  if (
    selectedWorker.webhookQueueId && queue &&
    selectedWorker.webhookQueueId !== queue.id
  ) {
    throw new Error(
      `Worker \`${selectedWorker.workerName}\` records webhook Queue ID ` +
        `${selectedWorker.webhookQueueId}, but the same name now belongs to ` +
        `${queue.id}. The replacement Queue was not adopted.`,
    );
  }
  const config: MicrofeedConfig = {
    accountId: selectedWorker.accountId,
    adminAuthMode: selectedWorker.adminAuthMode,
    adminPath: selectedWorker.adminPath,
    completedSteps: [
      "d1-ready",
      ...(selectedWorker.r2Ready ? ["r2-ready"] : []),
      "worker-deployed",
      "deployment-verified",
      ...(secretNames.has("BETTER_AUTH_SECRET")
        ? ["better-auth-secret-created"]
        : []),
      ...(secretNames.has("UPLOAD_SIGNING_KEY")
        ? ["upload-signing-secret-created"]
        : []),
      ...(selectedWorker.webhookQueueName
        ? ["webhook-queue-ready"]
        : []),
      ...(selectedWorker.webhookQueueName && secretNames.has("WEBHOOK_SECRET_KEY")
        ? ["webhook-secret-created"]
        : []),
    ],
    customDomain,
    deploymentEnvironment: preview ? "preview" : "production",
    d1: {
      id: selectedWorker.d1.id,
      name: selectedWorker.d1.name,
      reuse: true,
    },
    deploymentUrl: selectedWorker.workersDevUrl ?? identity.baseUrl,
    hosting: "cloudflare",
    instanceId: identity.instanceId,
    instanceName: requestedInstanceName,
    projectName: selectedWorker.projectName,
    r2: {
      name: selectedWorker.r2Name,
      reuse: selectedWorker.r2Ready,
      setupMode: selectedWorker.r2SetupMode,
    },
    workerName: selectedWorker.workerName,
    ...(selectedWorker.webhookQueueName
      ? {
          webhooks: {
            queueId: queue!.id,
            queueName: selectedWorker.webhookQueueName,
            state: selectedWorker.webhookState === "disabled"
              ? "disabled"
              : "enabled",
          },
        }
      : {}),
  };
  await generateWranglerConfig(config);
  await writeConfig(config);
  await setActiveInstance(requestedInstanceName);
  prompts.note(
    [
      `Instance: ${requestedInstanceName}`,
      `Worker: ${selectedWorker.workerName}`,
      `Account: ${selectedWorker.accountName}`,
      `Verified at: ${identity.baseUrl}`,
      "Cloudflare changes: none",
    ].join("\n"),
    "✅ Cloudflare instance connected",
  );
  prompts.outro(
    "The Worker is now managed from this repository. Local development uses " +
      "isolated D1 and R2 simulations; production data is not copied.",
  );
}

export async function useInstanceCommand(flags: Flags): Promise<void> {
  const requested = flagString(flags, "instance");
  const instances = await listLocalInstances();
  if (instances.length === 0) {
    throw new Error(
      "No saved microfeed instances are configured. Run " +
        "`yarn manage init --local --instance <name>` or " +
        "`yarn manage init --instance <name>` first.",
    );
  }
  const selected = requested ??
    (
      instances.length === 1
        ? instances[0]!
        : await chooseLocalInstance(
            instances,
            "Which microfeed instance should become active?",
          )
    );
  if (!instances.includes(selected)) {
    throw new Error(
      `Instance \`${selected}\` was not found. Run ` +
        "`yarn manage instances` to list configured instances.",
    );
  }
  await setActiveInstance(selected);
  process.stdout.write(`Active microfeed instance: ${selected}\n`);
}

export async function devCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const enableWebhooks = flagBoolean(flags, "enable-webhooks");
  const disableWebhooks = flagBoolean(flags, "disable-webhooks");
  if (enableWebhooks && disableWebhooks) {
    throw new Error(
      "`--enable-webhooks` and `--disable-webhooks` cannot be combined.",
    );
  }
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  await resolveCommandInstance(context, true);
  const config = await ensureWranglerConfig(
    true,
    flagBoolean(flags, "preview"),
    context.instanceName,
  );
  const developmentConfig: MicrofeedConfig = {
    ...config,
    webhooks: {
      queueName: webhookQueueName(`${workerName(config)}-local`),
      state: disableWebhooks ? "unprovisioned" : "enabled",
    },
  };
  await generateWranglerConfig(developmentConfig);
  try {
    prompts.note(
      [
        `Local sandbox: ${config.instanceName}`,
        `Instance type: ${
          isLocalOnly(config)
            ? "Local only"
            : "Cloudflare — managed here"
        }`,
        `D1: ${config.d1.name} (local simulation)`,
        `R2: ${config.r2.name} (local simulation)`,
        `Webhooks: ${disableWebhooks
          ? "disabled for this run"
          : `${developmentConfig.webhooks!.queueName} (local simulation)`}`,
        "Production D1 and R2 data will not be accessed or changed.",
        "No Cloudflare Queue resources, permissions, or charges are used.",
      ].join("\n"),
      "Local development",
    );
    if (enableWebhooks) {
      prompts.log.info(
        "Webhook Queue simulation is already enabled for every local development session; --enable-webhooks is optional.",
      );
    }
    await context.cloudflare.applyLocalMigrations(config);
    await prepareItemSearch(context.cloudflare, config, {
      local: true,
      persistTo: localPersistencePath(config),
    });
    await runYarnScript(runner, "dev:astro", {
      env: {
        ...process.env,
        MICROFEED_INSTANCE: config.instanceName,
        MICROFEED_LOCAL_STATE: localPersistencePath(config),
        MICROFEED_WRANGLER_CONFIG: wranglerConfigPath(config),
      },
      interactive: true,
    });
  } finally {
    await generateWranglerConfig(config);
  }
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function databaseTableNames(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<string[]> {
  const rows = await cloudflare.queryD1(
    config,
    "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name",
    options,
  );
  return rows.flatMap(({name}) => typeof name === "string" ? [name] : []);
}

async function databaseIndexDefinitions(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  tables: readonly string[] | null = null,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<SnapshotIndexDefinition[]> {
  if (tables?.length === 0) return [];
  const tableFilter = tables
    ? ` AND tbl_name IN (${tables.map(sqlString).join(", ")})`
    : "";
  const rows = await cloudflare.queryD1(
    config,
    "SELECT name, sql FROM sqlite_schema WHERE type = 'index' " +
      `AND sql IS NOT NULL${tableFilter} ORDER BY name`,
    options,
  );
  return rows.map(({name, sql}) => {
    if (typeof name !== "string" || !name || typeof sql !== "string" || !sql) {
      throw new Error("D1 returned an invalid index definition.");
    }
    return {name, sql: `${sql.trim().replace(/;$/u, "")};`};
  });
}

async function migrationLedger(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<string[]> {
  const rows = await cloudflare.queryD1(
    config,
    "SELECT name FROM d1_migrations ORDER BY id",
    options,
  );
  return rows.map(({name}) => {
    if (typeof name !== "string" || !name) {
      throw new Error("D1 returned an invalid migration ledger.");
    }
    return name;
  });
}

async function durableRowCounts(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  tables: readonly string[],
  options: {local?: boolean; persistTo?: string} = {},
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await cloudflare.queryD1(
      config,
      `SELECT COUNT(*) AS count FROM ${sqlIdentifier(table)}`,
      options,
    );
    if (!row || !Number.isSafeInteger(row.count) || Number(row.count) < 0) {
      throw new Error(`D1 returned an invalid row count for ${table}.`);
    }
    result[table] = Number(row.count);
  }
  return result;
}

async function remoteRestoreFingerprint(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
): Promise<string> {
  const tableNames = await databaseTableNames(cloudflare, config);
  const applicationTables = applicationTablesFromSqlite(tableNames);
  assertClassifiedTables(applicationTables);
  const rows: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of [
    ...SNAPSHOT_TABLES.durable,
    ...SNAPSHOT_TABLES.targetSpecific,
  ].filter((table) => applicationTables.includes(table))) {
    rows[table] = await cloudflare.queryD1(
      config,
      `SELECT * FROM ${sqlIdentifier(table)} ORDER BY rowid`,
    );
  }
  const [migrations, objects] = await Promise.all([
    migrationLedger(cloudflare, config),
    cloudflare.listR2Objects(cloudflareAccountId(config), config.r2.name),
  ]);
  return createHash("sha256").update(JSON.stringify({
    applicationTables,
    migrations,
    objects,
    rows,
  })).digest("hex");
}

async function recordRemoteRestoreBaseline(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  if (
    config.restoreBaseline ||
    config.d1.reuse ||
    config.r2.reuse
  ) {
    return;
  }
  const objects = await context.cloudflare.listR2Objects(
    cloudflareAccountId(config),
    config.r2.name,
  );
  if (objects.length > 0) {
    throw new Error(
      "The newly initialized R2 bucket is not empty, so it cannot be marked as a fresh snapshot restore target.",
    );
  }
  config.restoreBaseline = {
    createdAt: new Date().toISOString(),
    fingerprint: await remoteRestoreFingerprint(context.cloudflare, config),
  };
  await writeConfig(config);
}

function snapshotOutputPath(flags: Flags, instanceName: string): string {
  const requested = flagString(flags, "output");
  if (requested) {
    return path.resolve(requested);
  }
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  return path.resolve(`microfeed-${instanceName}-${timestamp}.tar.gz`);
}

const SNAPSHOT_PROGRESS_REPORT_BYTES = 8 * 1024 * 1024;
const SNAPSHOT_PROGRESS_REPORT_MS = 1_000;

export function formatSnapshotBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const displayed = unitIndex === 0
    ? String(Math.round(value))
    : value >= 10
      ? value.toFixed(0)
      : value.toFixed(1);
  return `${displayed} ${units[unitIndex]}`;
}

export function snapshotMediaProgressMessage(input: {
  downloadedBytes: number;
  objectCount: number;
  objectNumber: number;
  totalBytes: number;
}): string {
  if (input.objectCount === 0) {
    return "R2 media bucket is empty; no objects to download";
  }
  return `Downloading R2 media: object ${input.objectNumber} of ${input.objectCount}; ` +
    `${formatSnapshotBytes(input.downloadedBytes)} of ${formatSnapshotBytes(input.totalBytes)}`;
}

export function snapshotCreatedMessage(output: string): string {
  return `✅ Snapshot created at ${output}. It contains sensitive data, is ` +
    "unencrypted, and is readable only by your user account.";
}

export function localSnapshotNextSteps(
  instanceName: string,
  needsLoginSetup: boolean,
): string {
  const startCommand = `yarn dev --instance ${instanceName}`;
  if (!needsLoginSetup) {
    return `Run \`${startCommand}\` to start it.`;
  }
  return [
    "Set up the local dashboard login:",
    "",
    "yarn manage auth setup \\",
    `  --instance ${instanceName}`,
    "",
    `Then run \`${startCommand}\` to start it.`,
  ].join("\n");
}

export function remoteSnapshotNextSteps(
  instanceName: string,
  needsLoginSetup: boolean,
): string {
  const completed = `Remote restore complete for ${instanceName}.`;
  if (!needsLoginSetup) return completed;
  return [
    completed,
    "",
    "The snapshot did not contain an administrator login. Set it up now:",
    "",
    "yarn manage auth setup \\",
    `  --instance ${instanceName}`,
  ].join("\n");
}

export function remoteRestoreTargetReadinessError(
  config: MicrofeedConfig,
): string | null {
  if (config.restoreBaseline && isR2Ready(config)) {
    return null;
  }
  const reasons: string[] = [];
  if (!isR2Ready(config)) {
    reasons.push(
      "R2 media storage is not ready. Enable it with " +
        `\`yarn manage deploy --enable-r2 --instance ${config.instanceName}\` ` +
        "before restoring a snapshot.",
    );
  }
  if (!config.restoreBaseline) {
    reasons.push(hasCompletedCloudflareInitialization(config)
      ? "The CLI has no fresh-target safety fingerprint, so it cannot prove " +
        "that this instance's D1 database and R2 bucket are fresh and " +
        "unchanged."
      : "Initialization did not finish successfully, so the CLI never " +
        "recorded the fresh-target safety fingerprint for its D1 database " +
        "and R2 bucket.");
  }
  if (config.d1.reuse) {
    reasons.push(
      `D1 database \`${config.d1.name}\` is marked as reused.`,
    );
  }
  if (config.r2.reuse) {
    reasons.push(
      `R2 bucket \`${config.r2.name}\` is marked as reused.`,
    );
  }
  const recovery = hasCompletedCloudflareInitialization(config)
    ? "Run the restore with `--dry-run`. The CLI will automatically repair " +
      "the missing fingerprint only if the deployed Worker belongs to this " +
      "instance, D1 contains no user-created content, and R2 is empty."
    : "Initialization must complete successfully before you retry remote " +
      "restore.";
  return `Snapshot archive validation passed, but instance \`${config.instanceName}\` ` +
    `is not ready for remote restore. ${reasons.join(" ")} ${recovery} ` +
    "Remote restore did not start; no target data was changed.";
}

export function canRepairRemoteRestoreBaseline(
  config: MicrofeedConfig,
): boolean {
  return !config.restoreBaseline &&
    isR2Ready(config) &&
    hasCompletedCloudflareInitialization(config);
}

export function validateRemoteRestoreBaselineRepair(input: {
  allowInitialPasswordSetup: boolean;
  applicationRowCounts: Record<string, number>;
  applicationTables: readonly string[];
  appliedMigrations: readonly string[];
  bootstrapChannelRows: readonly Record<string, unknown>[];
  bootstrapSettingRows: readonly Record<string, unknown>[];
  bootstrapWorkerName: string;
  currentIndexes: readonly string[];
  currentMigrations: readonly string[];
  expectedInstanceId: string;
  expectedIndexes: readonly string[];
  expectedPublicOrigins: readonly string[];
  initialPasswordSetupRows: readonly Record<string, unknown>[];
  installationInstanceIds: readonly string[];
  r2ObjectCount: number;
  themeRows?: readonly Record<string, unknown>[];
  themeStateRows?: readonly Record<string, unknown>[];
}): void {
  assertClassifiedTables(input.applicationTables);
  const expectedTables = [
    ...SNAPSHOT_TABLES.durable,
    ...SNAPSHOT_TABLES.ephemeral,
    ...SNAPSHOT_TABLES.targetSpecific,
  ].sort((left, right) => left.localeCompare(right));
  const expectedTableSet = new Set<string>(expectedTables);
  const actualTables = [...input.applicationTables]
    .sort((left, right) => left.localeCompare(right));
  const missingTables = expectedTables.filter((table) =>
    !actualTables.includes(table)
  );
  const unexpectedTables = actualTables.filter((table) =>
    !expectedTableSet.has(table)
  );
  if (missingTables.length > 0 || unexpectedTables.length > 0) {
    const problems = [
      ...(missingTables.length > 0
        ? [`Missing tables: ${missingTables.join(", ")}.`]
        : []),
      ...(unexpectedTables.length > 0
        ? [`Unexpected tables: ${unexpectedTables.join(", ")}.`]
        : []),
    ];
    throw new Error(
      "The remote D1 schema is not the current freshly initialized schema. " +
        problems.join(" "),
    );
  }
  if (
    input.appliedMigrations.length !== input.currentMigrations.length ||
    input.appliedMigrations.some((migration, index) =>
      migration !== input.currentMigrations[index]
    )
  ) {
    throw new Error(
      "The remote D1 migration ledger is not at this checkout's current head.",
    );
  }
  const currentIndexes = [...input.currentIndexes]
    .sort((left, right) => left.localeCompare(right));
  const expectedIndexes = [...input.expectedIndexes]
    .sort((left, right) => left.localeCompare(right));
  if (
    currentIndexes.length !== expectedIndexes.length ||
    currentIndexes.some((index, position) => index !== expectedIndexes[position])
  ) {
    throw new Error(
      "The remote D1 indexes do not match this checkout's current migrations.",
    );
  }
  const nonemptyNonBootstrapTables = Object.entries(input.applicationRowCounts)
    .filter(([table, count]) =>
      count !== 0 &&
      table !== "channels" &&
      table !== "settings" &&
      table !== "auth_password_setup" &&
      table !== "theme_state" &&
      table !== "themes"
    )
    .map(([table]) => table)
    .sort((left, right) => left.localeCompare(right));
  if (nonemptyNonBootstrapTables.length > 0) {
    throw new Error(
      "The remote D1 database contains application data in: " +
        `${nonemptyNonBootstrapTables.join(", ")}. It cannot be repaired as a fresh ` +
        "snapshot restore target.",
    );
  }
  validateRemoteRestoreBootstrapRows(input);
  validateRemoteRestoreInitialPasswordSetup(input);
  validateRemoteRestoreThemeState(input);
  if (
    input.installationInstanceIds.length !== 1 ||
    input.installationInstanceIds[0] !== input.expectedInstanceId
  ) {
    throw new Error(
      "The remote D1 installation identity does not match this instance.",
    );
  }
  if (input.r2ObjectCount !== 0) {
    throw new Error(
      "The remote R2 bucket is not empty, so it cannot be repaired as a " +
        "fresh snapshot restore target.",
    );
  }
}

function validateRemoteRestoreThemeState(input: {
  applicationRowCounts: Record<string, number>;
  themeRows?: readonly Record<string, unknown>[];
  themeStateRows?: readonly Record<string, unknown>[];
}): void {
  const count = input.applicationRowCounts.theme_state ?? 0;
  const themeCount = input.applicationRowCounts.themes ?? 0;
  const themes = input.themeRows ?? [];
  const rows = input.themeStateRows ?? [];
  if (count === 0 && rows.length === 0 && themeCount === 0 && themes.length === 0) return;
  const row = rows[0];
  const theme = themes[0];
  const oldInactiveState = themeCount === 0 && themes.length === 0 &&
    row?.active_theme_id === null;
  const bundledDefaultState = themeCount === 1 && themes.length === 1 &&
    typeof row?.active_theme_id === "string" &&
    row.active_theme_id === theme?.id &&
    theme?.package_id === DEFAULT_THEME_MANIFEST.packageId &&
    theme?.version === DEFAULT_THEME_MANIFEST.version &&
    theme?.source_kind === "bundled" &&
    theme?.deleted_at === null;
  if (
    count !== 1 ||
    rows.length !== 1 ||
    row?.id !== "current" ||
    row.previous_theme_id !== null ||
    (!oldInactiveState && !bundledDefaultState)
  ) {
    throw new Error(
      "The remote D1 theme state is not the automatic inactive state of a fresh instance.",
    );
  }
}

function validateRemoteRestoreInitialPasswordSetup(input: {
  allowInitialPasswordSetup: boolean;
  applicationRowCounts: Record<string, number>;
  initialPasswordSetupRows: readonly Record<string, unknown>[];
}): void {
  const count = input.applicationRowCounts.auth_password_setup ?? 0;
  if (count === 0 && input.initialPasswordSetupRows.length === 0) return;
  const row = input.initialPasswordSetupRows[0];
  const createdAt = typeof row?.createdAt === "string"
    ? Date.parse(row.createdAt)
    : Number.NaN;
  const expiresAt = typeof row?.expiresAt === "string"
    ? Date.parse(row.expiresAt)
    : Number.NaN;
  const setupWindow = expiresAt - createdAt;
  if (
    !input.allowInitialPasswordSetup ||
    count !== 1 ||
    input.initialPasswordSetupRows.length !== 1 ||
    row?.id !== "owner" ||
    row.purpose !== "initial" ||
    row.userId !== null ||
    typeof row.email !== "string" ||
    validateOwnerEmail(row.email) !== undefined ||
    row.email !== normalizeOwnerEmail(row.email) ||
    typeof row.tokenHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(row.tokenHash) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    setupWindow <= 0 ||
    setupWindow > 31 * 60 * 1_000
  ) {
    throw new Error(
      "The remote D1 password setup state is not the one-time initial login " +
        "record created for a fresh instance.",
    );
  }
}

function parsedJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function targetBootstrapLink(
  value: unknown,
  expectedOrigins: readonly string[],
  workerName: string,
): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.pathname !== "/" || url.search ||
      url.hash
    ) {
      return false;
    }
    if (expectedOrigins.includes(url.origin)) return true;
    return url.hostname.startsWith(`${workerName}.`) &&
      url.hostname.endsWith(".workers.dev");
  } catch {
    return false;
  }
}

function validBootstrapSubscribeMethod(
  value: unknown,
  expected: Record<string, unknown>,
): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = value as Record<string, unknown>;
  if (
    typeof actual.id !== "string" ||
    !/^[A-Za-z0-9_-]{11}$/u.test(actual.id)
  ) {
    return false;
  }
  return isDeepStrictEqual(
    {...actual, id: "<generated>"},
    {...expected, editable: false, enabled: true, id: "<generated>"},
  );
}

function validateRemoteRestoreBootstrapRows(input: {
  applicationRowCounts: Record<string, number>;
  bootstrapChannelRows: readonly Record<string, unknown>[];
  bootstrapSettingRows: readonly Record<string, unknown>[];
  bootstrapWorkerName: string;
  expectedPublicOrigins: readonly string[];
}): void {
  const channelCount = input.applicationRowCounts.channels ?? 0;
  const settingCount = input.applicationRowCounts.settings ?? 0;
  if (channelCount === 0 && settingCount === 0) return;
  if (
    channelCount !== 1 || settingCount !== 5 ||
    input.bootstrapChannelRows.length !== 1 ||
    input.bootstrapSettingRows.length !== 5
  ) {
    throw new Error(
      "The remote D1 channels and settings are not the automatic bootstrap " +
        "rows of a fresh microfeed instance.",
    );
  }

  const channelRow = input.bootstrapChannelRows[0]!;
  const channel = parsedJsonRecord(channelRow.data);
  if (!channel) {
    throw new Error("The remote D1 bootstrap channel contains invalid data.");
  }
  const {copyright, link, ...channelRest} = channel;
  if (
    typeof channelRow.id !== "string" ||
    !/^[A-Za-z0-9_-]{11}$/u.test(channelRow.id) ||
    Number(channelRow.status) !== STATUSES.PUBLISHED ||
    Number(channelRow.is_primary) !== 1 ||
    copyright !== DEFAULT_CHANNEL_COPYRIGHT ||
    !targetBootstrapLink(
      link,
      input.expectedPublicOrigins,
      input.bootstrapWorkerName,
    ) ||
    !isDeepStrictEqual(channelRest, {
      categories: [],
      image: "/assets/default/channel-image.png",
      "itunes:block": false,
      "itunes:complete": false,
      "itunes:explicit": false,
      "itunes:type": "episodic",
      language: "en-us",
    })
  ) {
    throw new Error(
      "The remote D1 channel is not the automatic bootstrap channel of this " +
        "fresh microfeed instance.",
    );
  }

  const settings = new Map<string, Record<string, unknown>>();
  for (const row of input.bootstrapSettingRows) {
    if (typeof row.category !== "string") continue;
    const data = parsedJsonRecord(row.data);
    if (data) settings.set(row.category, data);
  }
  const subscribeMethods = settings.get(SETTINGS_CATEGORIES.SUBSCRIBE_METHODS);
  const methods = subscribeMethods?.methods;
  const webGlobalSettings = settings.get(
    SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
  );
  const sharedWebGlobalSettings = {
    favicon: {
      contentType: "image/png",
      url: "/assets/default/favicon.png",
    },
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    publicBucketUrl: "/media/",
  };
  const validWebGlobalSettings = isDeepStrictEqual(webGlobalSettings, {
    ...sharedWebGlobalSettings,
    itemsOrder: ITEM_ORDERS.DESC,
    itemsSort: ITEM_SORTS.PUBLISHED_AT,
  }) || isDeepStrictEqual(webGlobalSettings, {
    ...sharedWebGlobalSettings,
    itemsSortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
  });
  if (
    settings.size !== 5 || !Array.isArray(methods) || methods.length !== 2 ||
    !validBootstrapSubscribeMethod(
      methods[0],
      PREDEFINED_SUBSCRIBE_METHODS.rss,
    ) ||
    !validBootstrapSubscribeMethod(
      methods[1],
      PREDEFINED_SUBSCRIBE_METHODS.json,
    ) ||
    !validWebGlobalSettings ||
    !isDeepStrictEqual(settings.get(SETTINGS_CATEGORIES.ACCESS), {
      currentPolicy: "public",
    }) ||
    !isDeepStrictEqual(settings.get(SETTINGS_CATEGORIES.ANALYTICS), {}) ||
    !isDeepStrictEqual(settings.get(SETTINGS_CATEGORIES.CUSTOM_CODE), {})
  ) {
    throw new Error(
      "The remote D1 settings are not the automatic bootstrap settings of " +
        "a fresh microfeed instance.",
    );
  }
}

async function assertFreshRemoteRestoreBaselineTarget(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  const tableNames = await databaseTableNames(context.cloudflare, config);
  const applicationTables = applicationTablesFromSqlite(tableNames);
  const targetSpecificTables = new Set<string>(SNAPSHOT_TABLES.targetSpecific);
  const countedTables = applicationTables.filter((table) =>
    !targetSpecificTables.has(table)
  );
  const [appliedMigrations, currentMigrations, currentIndexes, expectedIndexes,
    rowCounts, channels, settings, passwordSetups, themes, themeState, installations, objects] =
    await Promise.all([
      migrationLedger(context.cloudflare, config),
      repositoryMigrations(),
      databaseIndexDefinitions(context.cloudflare, config, applicationTables),
      repositoryIndexDefinitions(),
      durableRowCounts(context.cloudflare, config, countedTables),
      context.cloudflare.queryD1(
        config,
        "SELECT id, status, is_primary, data FROM channels ORDER BY id",
      ),
      context.cloudflare.queryD1(
        config,
        "SELECT category, data FROM settings ORDER BY category",
      ),
      context.cloudflare.queryD1(
        config,
        "SELECT id, purpose, email, userId, tokenHash, createdAt, expiresAt " +
          "FROM auth_password_setup ORDER BY id",
      ),
      context.cloudflare.queryD1(
        config,
        "SELECT id, package_id, version, source_kind, deleted_at FROM themes ORDER BY id",
      ),
      context.cloudflare.queryD1(
        config,
        "SELECT id, active_theme_id, previous_theme_id FROM theme_state ORDER BY id",
      ),
      context.cloudflare.queryD1(
        config,
        "SELECT instanceId FROM microfeed_installation ORDER BY id",
      ),
      context.cloudflare.listR2Objects(
        cloudflareAccountId(config),
        config.r2.name,
      ),
    ]);
  validateRemoteRestoreBaselineRepair({
    allowInitialPasswordSetup: adminAuthMode(config) === "built-in",
    applicationRowCounts: rowCounts,
    applicationTables,
    appliedMigrations,
    bootstrapChannelRows: channels,
    bootstrapSettingRows: settings,
    bootstrapWorkerName: workerName(config),
    currentIndexes: currentIndexes.map(({name}) => name),
    currentMigrations: currentMigrations.map(({filename}) => filename),
    expectedIndexes: expectedIndexes.map(({name}) => name),
    expectedInstanceId: config.instanceId,
    expectedPublicOrigins: [
      config.deploymentUrl,
      deploymentVerificationUrl(config),
    ].flatMap((value) => {
      if (!value) return [];
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    }),
    initialPasswordSetupRows: passwordSetups,
    installationInstanceIds: installations.flatMap(({instanceId}) =>
      typeof instanceId === "string" ? [instanceId] : []
    ),
    r2ObjectCount: objects.length,
    themeRows: themes,
    themeStateRows: themeState,
  });
}

export function remoteRestoreBaselineRepairNotice(
  config: MicrofeedConfig,
): {message: string; title: string} {
  return {
    message: [
      `Instance: ${config.instanceName}`,
      `D1 database: ${config.d1.name} (${config.d1.id})`,
      `R2 bucket: ${config.r2.name}`,
      "Worker identity: matches this saved instance",
      "D1 content: automatic first-run defaults only; no user-created " +
        "content found",
      "R2 content: empty",
      "Snapshot restore: not started",
      "Cloudflare changes: none",
      "Local safety record: saving automatically so the later restore will " +
        "refuse to start if this target changes",
      "",
      "D1 and R2 ownership flags stay unchanged; resources already marked " +
        "reused remain protected from `yarn manage destroy`.",
    ].join("\n"),
    title: "Fresh snapshot restore target verified",
  };
}

async function assertFreshRemoteRestoreTarget(
  context: CommandContext,
  config: MicrofeedConfig,
  activity: WaitActivity,
): Promise<void> {
  const accountId = cloudflareAccountId(config);
  activity.update("Checking the exact D1 database identity");
  const databases = await context.cloudflare.d1Databases(accountId);
  const database = databases.find(({id}) => id === config.d1.id);
  if (!database || database.name !== config.d1.name) {
    throw new Error(
      `D1 database \`${config.d1.name}\` (${config.d1.id}) was not found ` +
        "with the saved identity.",
    );
  }

  activity.update("Checking the deployed Worker installation identity");
  const verificationUrl = deploymentVerificationUrl(config);
  if (!verificationUrl) {
    throw new Error("The initialized instance has no deployment URL.");
  }
  await verifyDeployment(config, verificationUrl, {runner: context.runner});

  activity.update("Checking the D1 schema, migrations, and empty tables");
  await assertFreshRemoteRestoreBaselineTarget(context, config);
}

async function saveVerifiedRemoteRestoreBaseline(
  context: CommandContext,
  config: MicrofeedConfig,
  activity: WaitActivity,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    activity.update("Recording the verified D1 and R2 state");
    const fingerprint = await remoteRestoreFingerprint(
      context.cloudflare,
      config,
    );
    activity.update("Rechecking that the target stayed fresh");
    await assertFreshRemoteRestoreBaselineTarget(context, config);
    const recheckedFingerprint = await remoteRestoreFingerprint(
      context.cloudflare,
      config,
    );
    if (recheckedFingerprint === fingerprint) {
      config.restoreBaseline = {
        createdAt: new Date().toISOString(),
        fingerprint,
      };
      await writeConfig(config);
      return;
    }
  }
  throw new Error(
    "The remote target kept changing while its fresh state was being checked. " +
      "Wait for other requests or deployments to finish, then retry.",
  );
}

export async function reverifyRemoteRestoreTargetIfFingerprintChanged(input: {
  currentFingerprint: string;
  expectedFingerprint: string;
  reverify: () => Promise<void>;
}): Promise<boolean> {
  if (input.currentFingerprint === input.expectedFingerprint) return false;
  await input.reverify();
  return true;
}

async function repairRemoteRestoreBaseline(
  context: CommandContext,
  config: MicrofeedConfig,
): Promise<void> {
  await withSpinner(
    {
      error: "Could not repair the remote restore safety fingerprint",
      start: "Proving that the initialized remote target is still empty",
      success: "Remote target is fresh and belongs to this instance",
    },
    (activity) => assertFreshRemoteRestoreTarget(context, config, activity),
  );

  const notice = remoteRestoreBaselineRepairNotice(config);
  prompts.note(notice.message, notice.title);
  await withSpinner(
    {
      error: "Could not save the fresh-target verification",
      start: "Saving the fresh-target verification locally",
      success: "Fresh-target verification saved locally; continuing the dry run",
    },
    async (activity) => {
      await saveVerifiedRemoteRestoreBaseline(context, config, activity);
    },
  );
}

async function assertPathDoesNotExist(filename: string): Promise<void> {
  try {
    await stat(filename);
    throw new Error(
      `Refusing to overwrite existing snapshot file ${filename}. Choose another --output path.`,
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function downloadSnapshotObject(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  object: Awaited<ReturnType<CloudflareClient["listR2Objects"]>>[number],
  filename: string,
  onBytes?: (bytes: number) => void,
): Promise<{sha256: string; size: number}> {
  const response = await cloudflare.r2ObjectResponse(
    cloudflareAccountId(config),
    config.r2.name,
    object.key,
  );
  if (!response.body) {
    throw new Error(`Cloudflare returned no body for R2 object ${object.key}.`);
  }
  const hash = createHash("sha256");
  let size = 0;
  const checksum = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      onBytes?.(chunk.length);
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as never),
    checksum,
    createWriteStream(filename, {mode: 0o600}),
  );
  if (size !== object.size) {
    throw new Error(
      `R2 object ${object.key} changed size while the snapshot was being created. Retry after writes have stopped.`,
    );
  }
  return {sha256: hash.digest("hex"), size};
}

async function createRemoteSnapshot(
  context: CommandContext,
  output: string,
  progress: (message: string) => void = () => undefined,
): Promise<string> {
  progress("Checking the source instance and Cloudflare access");
  await assertPathDoesNotExist(output);
  const config = await ensureWranglerConfig(false, false, context.instanceName);
  if (config.deploymentEnvironment === "preview") {
    throw new Error("Preview environments cannot create portable snapshots.");
  }
  if (!isR2Ready(config)) {
    throw new Error(
      `Portable snapshots require R2 media storage. Run ` +
        `\`yarn manage deploy --enable-r2 --instance ${config.instanceName}\` ` +
        "before creating or pulling a snapshot.",
    );
  }
  const accountId = cloudflareAccountId(config);
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error(`This installation belongs to Cloudflare account ${accountId}.`);
  }
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "microfeed-snapshot-create-"),
  );
  try {
    const databaseDirectory = path.join(temporaryDirectory, "database");
    const mediaDirectory = path.join(temporaryDirectory, "media");
    await Promise.all([
      mkdir(databaseDirectory, {recursive: true}),
      mkdir(mediaDirectory, {recursive: true}),
    ]);
    progress("Inspecting D1 schema and migration history");
    const migrations = await repositoryMigrations();
    const tableNames = await databaseTableNames(context.cloudflare, config);
    const applicationTables = applicationTablesFromSqlite(tableNames);
    assertClassifiedTables(applicationTables);
    const ledgerBefore = await migrationLedger(context.cloudflare, config);
    const appliedMigrations = validateAppliedMigrationPrefix(
      ledgerBefore,
      migrations,
    );
    const schemaPath = path.join(databaseDirectory, "schema.sql");
    const dataPath = path.join(databaseDirectory, "data.sql");
    const durableTables = SNAPSHOT_TABLES.durable.filter((table) =>
      applicationTables.includes(table)
    );
    await withItemSearchIndexesSuspended(
      context.cloudflare,
      config,
      async () => {
        progress("Exporting the D1 schema");
        await context.cloudflare.exportD1(
          config,
          schemaPath,
          [...applicationTables, "d1_migrations"],
          "schema",
        );
        progress("Capturing explicit D1 indexes");
        const indexDefinitions = await databaseIndexDefinitions(
          context.cloudflare,
          config,
          applicationTables,
        );
        const exportedIndexNames = new Set(
          migrationIndexDefinitions(await readFile(schemaPath, "utf8"))
            .map(({name}) => name),
        );
        const missingIndexDefinitions = indexDefinitions.filter(
          ({name}) => !exportedIndexNames.has(name),
        );
        if (missingIndexDefinitions.length > 0) {
          await appendFile(
            schemaPath,
            `\n${missingIndexDefinitions.map(({sql}) => sql).join("\n")}\n`,
            "utf8",
          );
        }
        progress("Exporting durable D1 data and the migration ledger");
        await context.cloudflare.exportD1(
          config,
          dataPath,
          [...durableTables, "d1_migrations"],
          "data",
        );
      },
    );
    progress("Counting durable D1 rows for restore verification");
    const rowCounts = await durableRowCounts(
      context.cloudflare,
      config,
      durableTables,
    );
    progress("Listing R2 media objects");
    const listedObjects = await context.cloudflare.listR2Objects(
      accountId,
      config.r2.name,
    );
    const totalMediaBytes = listedObjects.reduce(
      (total, object) => total + object.size,
      0,
    );
    let downloadedMediaBytes = 0;
    let lastReportedBytes = 0;
    let lastReportedAt = Date.now();
    const objects: SnapshotR2Object[] = [];
    progress(snapshotMediaProgressMessage({
      downloadedBytes: 0,
      objectCount: listedObjects.length,
      objectNumber: listedObjects.length > 0 ? 1 : 0,
      totalBytes: totalMediaBytes,
    }));
    for (const [index, object] of listedObjects.entries()) {
      const archivePath = `media/${String(index + 1).padStart(8, "0")}`;
      progress(snapshotMediaProgressMessage({
        downloadedBytes: downloadedMediaBytes,
        objectCount: listedObjects.length,
        objectNumber: index + 1,
        totalBytes: totalMediaBytes,
      }));
      const stored = await downloadSnapshotObject(
        context.cloudflare,
        config,
        object,
        path.join(temporaryDirectory, archivePath),
        (bytes) => {
          downloadedMediaBytes += bytes;
          const now = Date.now();
          if (
            downloadedMediaBytes === totalMediaBytes ||
            downloadedMediaBytes - lastReportedBytes >=
              SNAPSHOT_PROGRESS_REPORT_BYTES ||
            now - lastReportedAt >= SNAPSHOT_PROGRESS_REPORT_MS
          ) {
            progress(snapshotMediaProgressMessage({
              downloadedBytes: downloadedMediaBytes,
              objectCount: listedObjects.length,
              objectNumber: index + 1,
              totalBytes: totalMediaBytes,
            }));
            lastReportedBytes = downloadedMediaBytes;
            lastReportedAt = now;
          }
        },
      );
      progress(snapshotMediaProgressMessage({
        downloadedBytes: downloadedMediaBytes,
        objectCount: listedObjects.length,
        objectNumber: index + 1,
        totalBytes: totalMediaBytes,
      }));
      objects.push({
        archivePath,
        customMetadata: object.customMetadata,
        etag: object.etag,
        httpMetadata: object.httpMetadata,
        key: object.key,
        sha256: stored.sha256,
        size: stored.size,
        storageClass: object.storageClass,
        uploaded: object.uploaded,
      });
    }
    progress("Verifying D1 and R2 did not change during export");
    const [ledgerAfter, listedAfter] = await Promise.all([
      migrationLedger(context.cloudflare, config),
      context.cloudflare.listR2Objects(accountId, config.r2.name),
    ]);
    if (JSON.stringify(ledgerAfter) !== JSON.stringify(ledgerBefore)) {
      throw new Error(
        "The D1 migration ledger changed during export. The incomplete snapshot was discarded; retry after deployment finishes.",
      );
    }
    if (JSON.stringify(listedAfter) !== JSON.stringify(listedObjects)) {
      throw new Error(
        "The R2 bucket changed during export. The incomplete snapshot was discarded; retry after media writes have stopped.",
      );
    }
    const tables = Object.fromEntries(
      (Object.keys(SNAPSHOT_TABLES) as Array<keyof typeof SNAPSHOT_TABLES>)
        .map((category) => [
          category,
          SNAPSHOT_TABLES[category].filter((table) =>
            tableNames.includes(table)
          ),
        ]),
    ) as SnapshotManifest["database"]["tables"];
    progress("Writing the checksummed snapshot manifest");
    const manifest: SnapshotManifest = {
      createdAt: new Date().toISOString(),
      database: {
        data: {path: "database/data.sql", sha256: await sha256File(dataPath)},
        migrations: appliedMigrations,
        rowCounts,
        schema: {
          path: "database/schema.sql",
          sha256: await sha256File(schemaPath),
        },
        tables,
      },
      format: SNAPSHOT_FORMAT,
      media: {
        objectCount: objects.length,
        objects,
        totalBytes: objects.reduce((total, object) => total + object.size, 0),
      },
      source: {
        databaseName: config.d1.name,
        deploymentEnvironment: "production",
        instanceName: config.instanceName,
        projectName: config.projectName,
        r2BucketName: config.r2.name,
      },
      version: SNAPSHOT_VERSION,
    };
    await writeSnapshotManifest(temporaryDirectory, manifest);
    progress(`Compressing the snapshot into ${path.basename(output)}`);
    await createSnapshotArchive(temporaryDirectory, output);
    return output;
  } catch (error) {
    await rm(output, {force: true});
    throw error;
  } finally {
    await rm(temporaryDirectory, {force: true, recursive: true});
  }
}

async function createRemoteSnapshotWithProgress(
  context: CommandContext,
  output: string,
): Promise<string> {
  return withSpinner(
    {
      error: "Snapshot creation failed",
      start: "Preparing the portable snapshot",
      success: "Snapshot data downloaded and packaged",
    },
    (activity) => createRemoteSnapshot(context, output, activity.update),
  );
}

function assertSnapshotTableHistory(manifest: SnapshotManifest): void {
  const currentCategories = new Map<string, keyof typeof SNAPSHOT_TABLES>();
  for (const category of Object.keys(SNAPSHOT_TABLES) as Array<keyof typeof SNAPSHOT_TABLES>) {
    for (const table of SNAPSHOT_TABLES[category]) {
      currentCategories.set(table, category);
    }
  }
  for (const category of Object.keys(manifest.database.tables) as Array<keyof typeof SNAPSHOT_TABLES>) {
    for (const table of manifest.database.tables[category]) {
      const current = currentCategories.get(table);
      if (!current) {
        throw new Error(
          `Snapshot table ${table} is unknown to this checkout. Use a newer checkout.`,
        );
      }
      if (current !== category) {
        throw new Error(
          `Snapshot table ${table} changed classification from ${category} to ${current}. Historical snapshot classifications are immutable.`,
        );
      }
    }
  }
}

function snapshotApplicationTables(manifest: SnapshotManifest): string[] {
  return [
    ...manifest.database.tables.durable,
    ...manifest.database.tables.ephemeral,
    ...manifest.database.tables.targetSpecific,
  ];
}

async function repositoryIndexDefinitions(
  migrations?: readonly SnapshotMigration[],
): Promise<SnapshotIndexDefinition[]> {
  const selectedMigrations = migrations ?? await repositoryMigrations();
  const definitions = new Map<string, SnapshotIndexDefinition>();
  for (const migration of selectedMigrations) {
    const sql = await readFile(path.join(repositoryRoot, "migrations", migration.filename), "utf8");
    for (const definition of migrationIndexDefinitions(sql)) {
      definitions.set(definition.name, definition);
    }
  }
  return [...definitions.values()];
}

async function restoreSnapshotIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  manifest: SnapshotManifest,
  directory: string,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<void> {
  const expected = await repositoryIndexDefinitions(
    manifest.database.migrations,
  );
  if (expected.length === 0) return;
  const existing = new Set(
    (await databaseIndexDefinitions(cloudflare, config, null, options))
      .map(({name}) => name),
  );
  const missing = expected.filter(({name}) => !existing.has(name));
  if (missing.length === 0) return;
  const filename = path.join(directory, "restore-indexes.sql");
  await writeFile(
    filename,
    `${missing.map(({sql}) => sql).join("\n")}\n`,
    {encoding: "utf8", mode: 0o600},
  );
  await cloudflare.executeSqlFile(config, filename, options);
}

async function verifyImportedRowCounts(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  manifest: SnapshotManifest,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<void> {
  const durableTables = Object.keys(manifest.database.rowCounts);
  const counts = await durableRowCounts(cloudflare, config, durableTables, options);
  for (const table of durableTables) {
    if (counts[table] !== manifest.database.rowCounts[table]) {
      throw new Error(
        `Imported D1 row count for ${table} is ${counts[table]}, expected ${manifest.database.rowCounts[table]}.`,
      );
    }
  }
}

async function verifyRestoredDatabase(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  manifest: SnapshotManifest,
  options: {local?: boolean; persistTo?: string} = {},
): Promise<void> {
  const currentMigrations = await repositoryMigrations();
  const ledger = await migrationLedger(cloudflare, config, options);
  if (JSON.stringify(ledger) !==
      JSON.stringify(currentMigrations.map(({filename}) => filename))) {
    throw new Error("Restored D1 migration ledger does not match the current checkout.");
  }
  const tableNames = await databaseTableNames(cloudflare, config, options);
  const applications = applicationTablesFromSqlite(tableNames);
  assertClassifiedTables(applications);
  const expectedTables = [
    ...SNAPSHOT_TABLES.durable,
    ...SNAPSHOT_TABLES.ephemeral,
    ...SNAPSHOT_TABLES.targetSpecific,
  ];
  const missingTables = expectedTables.filter((table) => !applications.includes(table));
  if (missingTables.length > 0) {
    throw new Error(`Restored D1 is missing tables: ${missingTables.join(", ")}.`);
  }
  const indexRows = await cloudflare.queryD1(
    config,
    "SELECT name FROM sqlite_schema WHERE type = 'index' ORDER BY name",
    options,
  );
  const indexes = new Set(indexRows.flatMap(({name}) =>
    typeof name === "string" ? [name] : []
  ));
  const missingIndexes = (await repositoryIndexDefinitions()).map(({name}) => name)
    .filter((name) =>
    !indexes.has(name)
  );
  if (missingIndexes.length > 0) {
    throw new Error(`Restored D1 is missing indexes: ${missingIndexes.join(", ")}.`);
  }
  const foreignKeyFailures = await cloudflare.queryD1(
    config,
    "PRAGMA foreign_key_check",
    options,
  );
  if (foreignKeyFailures.length > 0) {
    throw new Error("Restored D1 failed foreign-key integrity checks.");
  }
  if ((manifest.database.rowCounts.auth_user ?? 0) > 0) {
    const owners = await cloudflare.queryD1(
      config,
      "SELECT id, email FROM auth_user ORDER BY createdAt LIMIT 1",
      options,
    );
    if (owners.length !== 1 || typeof owners[0]?.email !== "string") {
      throw new Error("Restored D1 administrator record is missing.");
    }
  }
  const [installation] = await cloudflare.queryD1(
    config,
    "SELECT instanceId FROM microfeed_installation WHERE id = 'installation'",
    options,
  );
  if (installation?.instanceId !== config.instanceId) {
    throw new Error("Restored D1 installation identity does not match its target.");
  }
}

function r2PutOptions(object: SnapshotR2Object) {
  return {
    customMetadata: object.customMetadata,
    httpMetadata: {
      ...object.httpMetadata,
      ...(object.httpMetadata.cacheExpiry
        ? {cacheExpiry: new Date(object.httpMetadata.cacheExpiry)}
        : {}),
    },
    ...(object.storageClass ? {storageClass: object.storageClass} : {}),
  };
}

function normalizedR2Metadata(input: {
  customMetadata?: Record<string, string>;
  httpMetadata?: SnapshotR2Object["httpMetadata"] | {
    cacheExpiry?: Date | string;
    [key: string]: unknown;
  };
  storageClass?: string | null;
}) {
  const customMetadata = Object.fromEntries(
    Object.entries(input.customMetadata ?? {})
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const rawHttpMetadata = input.httpMetadata ?? {};
  const httpMetadata = Object.fromEntries(
    Object.entries(rawHttpMetadata).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }
      if (key === "cacheExpiry") {
        return [[key, new Date(value as Date | string).toISOString()]];
      }
      return [[key, value]];
    }).sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    customMetadata,
    httpMetadata,
    storageClass: input.storageClass || "Standard",
  };
}

interface RestoredR2InventoryObject {
  customMetadata?: Record<string, string>;
  httpMetadata?: SnapshotR2Object["httpMetadata"] | {
    cacheExpiry?: Date | string;
    [key: string]: unknown;
  };
  key: string;
  size: number;
  storageClass?: string | null;
}

function snapshotValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized.length <= 500
    ? serialized
    : `${serialized.slice(0, 500)}…`;
}

export function restoredRemoteMediaMismatch(
  expectedObjects: readonly SnapshotR2Object[],
  restoredObjects: readonly RestoredR2InventoryObject[],
): string | null {
  const expectedByKey = new Map(expectedObjects.map((object) => [
    object.key,
    object,
  ]));
  const restoredByKey = new Map(restoredObjects.map((object) => [
    object.key,
    object,
  ]));
  const differences: string[] = [];
  for (const key of [...expectedByKey.keys()].sort()) {
    const expected = expectedByKey.get(key)!;
    const restored = restoredByKey.get(key);
    if (!restored) {
      differences.push(`missing object ${JSON.stringify(key)}`);
      continue;
    }
    if (restored.size !== expected.size) {
      differences.push(
        `${JSON.stringify(key)} has ${restored.size} bytes; expected ` +
          `${expected.size}`,
      );
    }
    const expectedMetadata = normalizedR2Metadata(expected);
    const restoredMetadata = normalizedR2Metadata(restored);
    if (!isDeepStrictEqual(restoredMetadata, expectedMetadata)) {
      differences.push(
        `${JSON.stringify(key)} metadata is ` +
          `${snapshotValue(restoredMetadata)}; expected ` +
          snapshotValue(expectedMetadata),
      );
    }
  }
  for (const key of [...restoredByKey.keys()].sort()) {
    if (!expectedByKey.has(key)) {
      differences.push(`unexpected object ${JSON.stringify(key)}`);
    }
  }
  if (differences.length === 0) {
    return null;
  }
  const visible = differences.slice(0, 8);
  const remaining = differences.length - visible.length;
  return [
    `Restored R2 verification found ${differences.length} difference${
      differences.length === 1 ? "" : "s"
    } (snapshot: ${expectedObjects.length} objects; restored: ` +
      `${restoredObjects.length} objects):`,
    ...visible.map((difference) => `- ${difference}`),
    ...(remaining > 0 ? [`- …and ${remaining} more`] : []),
  ].join("\n");
}

const REMOTE_MEDIA_VERIFICATION_DELAYS = [
  1_000,
  2_000,
  4_000,
  8_000,
  15_000,
  30_000,
] as const;

export async function verifyRestoredRemoteMediaWithRetries(input: {
  expected: readonly SnapshotR2Object[];
  list: () => Promise<readonly RestoredR2InventoryObject[]>;
  onRetry?: (delay: number, mismatch: string) => void;
  pause?: (milliseconds: number) => Promise<void>;
  retryDelays?: readonly number[];
}): Promise<void> {
  const pause = input.pause ?? wait;
  const retryDelays = input.retryDelays ?? REMOTE_MEDIA_VERIFICATION_DELAYS;
  for (let attempt = 0; ; attempt += 1) {
    const mismatch = restoredRemoteMediaMismatch(
      input.expected,
      await input.list(),
    );
    if (!mismatch) {
      return;
    }
    const delay = retryDelays[attempt];
    if (delay === undefined) {
      throw new Error(mismatch);
    }
    input.onRetry?.(delay, mismatch);
    await pause(delay);
  }
}

export async function restoreLocalMedia(
  config: MicrofeedConfig,
  snapshotDirectory: string,
  persistTo: string,
  objects: readonly SnapshotR2Object[],
): Promise<void> {
  const miniflare = new Miniflare({
    defaultPersistRoot: path.join(persistTo, "v3"),
    modules: true,
    r2Buckets: {MEDIA_BUCKET: config.r2.name},
    script: `export default {
      async fetch(request, env) {
        try {
          const decode = (value) => new TextDecoder().decode(
            Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
          );
          const encodedKey = request.headers.get("snapshot-key");
          const encodedOptions = request.headers.get("snapshot-r2-options");
          const key = encodedKey ? decode(encodedKey) : null;
          const options = encodedOptions
            ? JSON.parse(decode(encodedOptions))
            : null;
          if (!key || !options || !request.body) {
            return new Response("Invalid local restore request", {status: 400});
          }
          if (typeof options.httpMetadata?.cacheExpiry === "string") {
            options.httpMetadata.cacheExpiry = new Date(
              options.httpMetadata.cacheExpiry,
            );
          }
          await env.MEDIA_BUCKET.put(key, request.body, options);
          return new Response(null, {status: 204});
        } catch (error) {
          return Response.json(
            {error: error instanceof Error ? error.message : String(error)},
            {status: 500},
          );
        }
      },
    };`,
  });
  try {
    const bucket = await miniflare.getR2Bucket("MEDIA_BUCKET") as unknown as {
      head: (key: string) => Promise<{
        customMetadata?: Record<string, string>;
        httpMetadata?: Record<string, unknown>;
        size: number;
        storageClass?: string;
      } | null>;
    };
    for (const object of objects) {
      const filename = path.join(
        snapshotDirectory,
        ...object.archivePath.split("/"),
      );
      const body = Readable.toWeb(createReadStream(filename));
      const response = await miniflare.dispatchFetch("http://localhost/", {
        body,
        duplex: "half",
        headers: {
          "content-length": String(object.size),
          "snapshot-key": Buffer.from(object.key, "utf8").toString("base64"),
          "snapshot-r2-options": Buffer.from(
            JSON.stringify(r2PutOptions(object)),
            "utf8",
          ).toString("base64"),
        },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error(
          `Local R2 restore failed for ${object.key}: ${await response.text()}`,
        );
      }
      const restored = await bucket.head(object.key);
      if (!restored || restored.size !== object.size) {
        throw new Error(`Local R2 verification failed for ${object.key}.`);
      }
      const actualMetadata = normalizedR2Metadata(restored);
      const expectedMetadata = normalizedR2Metadata(object);
      if (JSON.stringify(actualMetadata) !== JSON.stringify(expectedMetadata)) {
        throw new Error(
          `Local R2 metadata verification failed for ${object.key}: ` +
            `expected ${JSON.stringify(expectedMetadata)}, received ` +
            `${JSON.stringify(actualMetadata)}.`,
        );
      }
    }
  } finally {
    await miniflare.dispose();
  }
}

async function restoreSnapshotLocally(
  archive: string,
  targetInstance: string,
  runner: CommandRunner,
  progress: (message: string) => void = () => undefined,
): Promise<{needsLoginSetup: boolean}> {
  const error = validateLocalInstanceName(targetInstance);
  if (error) {
    throw new Error(`Invalid instance name \`${targetInstance}\`. ${error}`);
  }
  const targetDirectory = instanceDirectory(targetInstance);
  const targetAlreadyExists = await stat(targetDirectory)
    .then(() => true)
    .catch((statError: unknown) => {
      if (statError instanceof Error && "code" in statError &&
          statError.code === "ENOENT") {
        return false;
      }
      throw statError;
    });
  if (targetAlreadyExists || await readConfig(false, targetInstance)) {
    throw new Error(
      `Local restore target \`${targetInstance}\` already exists. Choose a new instance name.`,
    );
  }
  const extractedDirectory = await mkdtemp(
    path.join(tmpdir(), "microfeed-snapshot-extract-"),
  );
  let createdConfig = false;
  try {
    progress("Validating the snapshot archive and migration history");
    const {manifest} = await extractSnapshotArchive(archive, extractedDirectory);
    validateSnapshotMigrations(
      manifest.database.migrations,
      await repositoryMigrations(),
    );
    assertSnapshotTableHistory(manifest);
    progress("Preparing the new local instance");
    const config = await ensureLocalOnlyConfig(targetInstance);
    createdConfig = true;
    const temporaryPersistence = path.join(
      instanceDirectory(targetInstance),
      `.snapshot-restore-${randomUUID()}`,
    );
    await mkdir(temporaryPersistence, {recursive: true});
    try {
      const schemaSql = await readFile(
        path.join(extractedDirectory, manifest.database.schema.path),
        "utf8",
      );
      const dataSql = await readFile(
        path.join(extractedDirectory, manifest.database.data.path),
        "utf8",
      );
      const restoreSqlPath = path.join(extractedDirectory, "restore.sql");
      await writeFile(restoreSqlPath, buildRestoreSql({
        currentApplicationTables: [],
        dataSql,
        schemaSql,
        snapshotApplicationTables: snapshotApplicationTables(manifest),
      }), {encoding: "utf8", mode: 0o600});
      progress("Importing the snapshot D1 schema and durable data");
      await new CloudflareClient(runner).executeSqlFile(
        config,
        restoreSqlPath,
        {local: true, persistTo: temporaryPersistence},
      );
      const cloudflare = new CloudflareClient(runner);
      progress("Verifying imported D1 row counts");
      await verifyImportedRowCounts(cloudflare, config, manifest, {
        local: true,
        persistTo: temporaryPersistence,
      });
      progress("Restoring historical D1 indexes");
      await restoreSnapshotIndexes(
        cloudflare,
        config,
        manifest,
        extractedDirectory,
        {local: true, persistTo: temporaryPersistence},
      );
      progress("Applying newer D1 migrations");
      await cloudflare.applyLocalMigrations(config, temporaryPersistence);
      await prepareItemSearch(cloudflare, config, {
        local: true,
        persistTo: temporaryPersistence,
      });
      const finalizationSqlPath = path.join(
        extractedDirectory,
        "finalize.sql",
      );
      await writeFile(
        finalizationSqlPath,
        buildRestoreFinalizationSql(config.instanceId),
        {encoding: "utf8", mode: 0o600},
      );
      progress("Recreating local installation state");
      await cloudflare.executeSqlFile(config, finalizationSqlPath, {
        local: true,
        persistTo: temporaryPersistence,
      });
      progress(
        manifest.media.objectCount === 0
          ? "The snapshot has no R2 media to restore"
          : `Restoring ${manifest.media.objectCount} R2 media ${
            manifest.media.objectCount === 1 ? "object" : "objects"
          } locally`,
      );
      await restoreLocalMedia(
        config,
        extractedDirectory,
        temporaryPersistence,
        manifest.media.objects,
      );
      progress("Verifying the restored local D1 and R2 data");
      await verifyRestoredDatabase(cloudflare, config, manifest, {
        local: true,
        persistTo: temporaryPersistence,
      });
      progress("Activating the restored local instance");
      const finalPersistence = localPersistencePath(config);
      await rename(temporaryPersistence, finalPersistence);
      markStep(config, "migrations-applied");
      markStep(config, "snapshot-restored");
      markStep(config, "initialization-complete");
      await writeConfig(config);
      await setActiveInstance(targetInstance);
      return {
        needsLoginSetup: (manifest.database.rowCounts.auth_user ?? 0) === 0,
      };
    } catch (restoreError) {
      await rm(temporaryPersistence, {force: true, recursive: true});
      throw restoreError;
    }
  } catch (restoreError) {
    if (createdConfig) {
      await removeSavedInstance(targetInstance);
    }
    throw restoreError;
  } finally {
    await rm(extractedDirectory, {force: true, recursive: true});
  }
}

async function restoreSnapshotLocallyWithProgress(
  archive: string,
  targetInstance: string,
  runner: CommandRunner,
): Promise<{needsLoginSetup: boolean}> {
  return withSpinner(
    {
      error: "Local snapshot restore failed",
      start: "Preparing the local snapshot restore",
      success: "Snapshot data restored and verified locally",
    },
    (activity) =>
      restoreSnapshotLocally(
        archive,
        targetInstance,
        runner,
        activity.update,
      ),
  );
}

const SNAPSHOT_RESTORE_ENDPOINT = "/__microfeed_snapshot_restore/v1";

export function maintenanceWorkerSource(): string {
  return `
function bytesFromHex(value) {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return Uint8Array.from(value.match(/../g), (byte) => Number.parseInt(byte, 16));
}
async function authorized(request, expectedHex) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const expected = bytesFromHex(expectedHex);
  if (!expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
function validMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function normalizedOptions(value) {
  const options = {...value};
  if (validMetadata(value.httpMetadata)) {
    options.httpMetadata = {...value.httpMetadata};
    if (typeof options.httpMetadata.cacheExpiry === "string") {
      options.httpMetadata.cacheExpiry = new Date(options.httpMetadata.cacheExpiry);
    }
  }
  return options;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== ${JSON.stringify(SNAPSHOT_RESTORE_ENDPOINT)} ||
        !await authorized(request, env.SNAPSHOT_TOKEN_HASH)) {
      return new Response("Snapshot restoration is in progress.", {
        status: 503,
        headers: {"cache-control": "no-store", "retry-after": "60"},
      });
    }
    if (request.method === "GET") return Response.json({maintenance: true});
    const action = url.searchParams.get("action");
    try {
      if (action === "create" && request.method === "POST") {
        const input = await request.json();
        if (typeof input.key !== "string" || !input.key || !validMetadata(input.options)) {
          return new Response("Invalid multipart metadata.", {status: 400});
        }
        const upload = await env.MEDIA_BUCKET.createMultipartUpload(
          input.key,
          normalizedOptions(input.options),
        );
        return Response.json({uploadId: upload.uploadId});
      }
      if (action === "part" && request.method === "PUT") {
        const key = url.searchParams.get("key");
        const uploadId = url.searchParams.get("uploadId");
        const partNumber = Number(url.searchParams.get("partNumber"));
        if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
          return new Response("Invalid multipart part.", {status: 400});
        }
        const part = await env.MEDIA_BUCKET.resumeMultipartUpload(key, uploadId)
          .uploadPart(partNumber, request.body);
        return Response.json(part);
      }
      if (action === "complete" && request.method === "POST") {
        const input = await request.json();
        if (typeof input.key !== "string" || typeof input.uploadId !== "string" ||
            !Array.isArray(input.parts)) {
          return new Response("Invalid multipart completion.", {status: 400});
        }
        const object = await env.MEDIA_BUCKET.resumeMultipartUpload(input.key, input.uploadId)
          .complete(input.parts);
        return Response.json({etag: object.etag, size: object.size});
      }
      if (action === "abort" && request.method === "POST") {
        const input = await request.json();
        if (typeof input.key !== "string" || typeof input.uploadId !== "string") {
          return new Response("Invalid multipart abort.", {status: 400});
        }
        await env.MEDIA_BUCKET.resumeMultipartUpload(input.key, input.uploadId)
          .abort();
        return Response.json({aborted: true});
      }
      if (action === "empty" && request.method === "PUT") {
        const input = await request.json();
        if (typeof input?.key !== "string" || !validMetadata(input.options)) {
          return new Response("Invalid empty object metadata.", {status: 400});
        }
        const object = await env.MEDIA_BUCKET.put(
          input.key,
          new Uint8Array(),
          normalizedOptions(input.options),
        );
        return Response.json({etag: object.etag, size: object.size});
      }
      return new Response("Unsupported snapshot action.", {status: 400});
    } catch (error) {
      return Response.json({error: error instanceof Error ? error.message : String(error)}, {status: 500});
    }
  },
};\n`;
}

export function snapshotMaintenanceRouting(config: MicrofeedConfig): {
  preview_urls: false;
  routes: Array<{custom_domain: true; pattern: string}>;
  workers_dev: true;
} {
  return {
    preview_urls: false,
    routes: config.customDomain
      ? [{custom_domain: true, pattern: config.customDomain}]
      : [],
    workers_dev: true,
  };
}

export function snapshotWorkerErrorDetail(
  body: string,
  contentType: string | null,
): string {
  const normalized = body.trim().replaceAll(/\s+/gu, " ");
  if (contentType?.toLowerCase().includes("text/html")) {
    const title = body.match(/<title[^>]*>([^<]+)<\/title>/iu)?.[1]?.trim();
    return title
      ? `Cloudflare returned an HTML page titled \`${title}\` instead of ` +
        "the maintenance API."
      : "Cloudflare returned an HTML page instead of the maintenance API.";
  }
  if (!normalized) return "No error detail was returned.";
  const maximumLength = 600;
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength)}…`;
}

async function deployMaintenanceWorker(
  context: CommandContext,
  config: MicrofeedConfig,
  temporaryDirectory: string,
  token: string,
): Promise<string> {
  if (!config.deploymentUrl) {
    throw new Error("The restore target has no deployment URL.");
  }
  const sourcePath = path.join(temporaryDirectory, "maintenance-worker.js");
  const configPath = path.join(temporaryDirectory, "maintenance-wrangler.json");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await writeFile(sourcePath, maintenanceWorkerSource(), {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeFile(configPath, `${JSON.stringify({
    account_id: cloudflareAccountId(config),
    compatibility_date: "2026-07-29",
    compatibility_flags: ["nodejs_compat"],
    main: sourcePath,
    name: workerName(config),
    observability: {enabled: false},
    r2_buckets: [{binding: "MEDIA_BUCKET", bucket_name: config.r2.name}],
    ...snapshotMaintenanceRouting(config),
    vars: {SNAPSHOT_TOKEN_HASH: tokenHash},
  }, null, 2)}\n`, {encoding: "utf8", mode: 0o600});
  await context.cloudflare.deployWithConfig(config, configPath);
  return new URL(SNAPSHOT_RESTORE_ENDPOINT, config.deploymentUrl).href;
}

async function snapshotWorkerRequest(
  endpoint: string,
  token: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    ...init,
    headers: {authorization: `Bearer ${token}`, ...init.headers},
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Snapshot maintenance Worker at ${endpoint} returned HTTP ` +
        `${response.status}. ${snapshotWorkerErrorDetail(
          body,
          response.headers.get("content-type"),
        )}`,
    );
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

async function waitForSnapshotWorker(
  endpoint: string,
  token: string,
): Promise<void> {
  let lastError: unknown;
  for (const delay of [0, 1_000, 2_000, 4_000, 8_000]) {
    if (delay > 0) {
      await wait(delay);
    }
    try {
      await snapshotWorkerRequest(endpoint, token, {method: "GET"});
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function uploadRemoteObject(
  endpoint: string,
  token: string,
  snapshotDirectory: string,
  object: SnapshotR2Object,
): Promise<void> {
  const filename = path.join(snapshotDirectory, ...object.archivePath.split("/"));
  const options = r2PutOptions(object);
  if (object.size === 0) {
    const url = new URL(endpoint);
    url.searchParams.set("action", "empty");
    await snapshotWorkerRequest(url.href, token, {
      body: JSON.stringify({key: object.key, options}),
      headers: {"content-type": "application/json"},
      method: "PUT",
    });
    return;
  }
  const createUrl = new URL(endpoint);
  createUrl.searchParams.set("action", "create");
  const created = await snapshotWorkerRequest(createUrl.href, token, {
    body: JSON.stringify({key: object.key, options}),
    headers: {"content-type": "application/json"},
    method: "POST",
  });
  const uploadId = created.uploadId;
  if (typeof uploadId !== "string" || !uploadId) {
    throw new Error(`Maintenance Worker did not create an upload for ${object.key}.`);
  }
  const minimumPartSize = 8 * 1024 * 1024;
  const partSize = Math.max(
    minimumPartSize,
    Math.ceil(object.size / 9_999),
  );
  try {
    const parts: Array<{etag: string; partNumber: number}> = [];
    for (let start = 0, partNumber = 1; start < object.size;
         start += partSize, partNumber += 1) {
      const end = Math.min(start + partSize, object.size) - 1;
      const partUrl = new URL(endpoint);
      partUrl.searchParams.set("action", "part");
      partUrl.searchParams.set("key", object.key);
      partUrl.searchParams.set("uploadId", uploadId);
      partUrl.searchParams.set("partNumber", String(partNumber));
      const response = await snapshotWorkerRequest(partUrl.href, token, {
        body: createReadStream(filename, {end, start}) as never,
        headers: {"content-length": String(end - start + 1)},
        method: "PUT",
        // Node requires duplex for streamed fetch request bodies.
        ...({duplex: "half"} as Record<string, unknown>),
      });
      if (typeof response.etag !== "string") {
        throw new Error(`Maintenance Worker did not accept part ${partNumber} of ${object.key}.`);
      }
      parts.push({etag: response.etag, partNumber});
    }
    const completeUrl = new URL(endpoint);
    completeUrl.searchParams.set("action", "complete");
    await snapshotWorkerRequest(completeUrl.href, token, {
      body: JSON.stringify({key: object.key, parts, uploadId}),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
  } catch (error) {
    const abortUrl = new URL(endpoint);
    abortUrl.searchParams.set("action", "abort");
    await snapshotWorkerRequest(abortUrl.href, token, {
      body: JSON.stringify({key: object.key, uploadId}),
      headers: {"content-type": "application/json"},
      method: "POST",
    }).catch(() => undefined);
    throw error;
  }
}

async function verifyRestoredRemoteMedia(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  objects: readonly SnapshotR2Object[],
  onRetry?: (delay: number) => void,
): Promise<void> {
  await verifyRestoredRemoteMediaWithRetries({
    expected: objects,
    list: () => cloudflare.listR2Objects(
      cloudflareAccountId(config),
      config.r2.name,
    ),
    onRetry: (delay) => onRetry?.(delay),
  });
}

export interface SnapshotRestoreJournal {
  accountId: string;
  archiveSha256: string;
  databaseId: string;
  instanceId: string;
  r2BucketName: string;
  stage: string;
  startedAt: string;
}

function restoreJournalPath(config: MicrofeedConfig): string {
  return path.join(instanceDirectory(config.instanceName), "snapshot-restore.json");
}

async function readRestoreJournal(
  config: MicrofeedConfig,
): Promise<SnapshotRestoreJournal | null> {
  try {
    return JSON.parse(await readFile(restoreJournalPath(config), "utf8")) as
      SnapshotRestoreJournal;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeRestoreJournal(
  config: MicrofeedConfig,
  journal: SnapshotRestoreJournal,
): Promise<void> {
  await writeFile(
    restoreJournalPath(config),
    `${JSON.stringify(journal, null, 2)}\n`,
    {encoding: "utf8", mode: 0o600},
  );
}

export function validateRestoreJournal(
  journal: SnapshotRestoreJournal,
  config: MicrofeedConfig,
  archiveSha256: string,
): void {
  if (
    journal.archiveSha256 !== archiveSha256 ||
    journal.accountId !== cloudflareAccountId(config) ||
    journal.databaseId !== config.d1.id ||
    journal.instanceId !== config.instanceId ||
    journal.r2BucketName !== config.r2.name
  ) {
    throw new Error(
      "A different snapshot restore is already in progress for this target. Resume it with the same archive before starting another restore.",
    );
  }
}

async function restoreSnapshotRemotely(
  context: CommandContext,
  archive: string,
): Promise<{needsLoginSetup: boolean}> {
  const extractedDirectory = await mkdtemp(
    path.join(tmpdir(), "microfeed-snapshot-remote-"),
  );
  try {
    const {manifest, pending} = await withSpinner(
      {
        error: "Snapshot archive validation failed",
        start: "Validating the snapshot archive and checksums",
        success: "Snapshot archive is valid; checking the restore target next",
      },
      async (activity) => {
        const {manifest} = await extractSnapshotArchive(
          archive,
          extractedDirectory,
        );
        activity.update("Comparing the snapshot and repository migrations");
        const currentMigrations = await repositoryMigrations();
        const {pending} = validateSnapshotMigrations(
          manifest.database.migrations,
          currentMigrations,
        );
        assertSnapshotTableHistory(manifest);
        return {manifest, pending};
      },
    );
    const config = await ensureWranglerConfig(false, false, context.instanceName);
    if (flagBoolean(context.flags, "yes")) {
      throw new Error("Remote snapshot restore does not support --yes.");
    }
    const accountId = cloudflareAccountId(config);
    let readinessError = remoteRestoreTargetReadinessError(config);
    if (readinessError && !canRepairRemoteRestoreBaseline(config)) {
      throw new Error(readinessError);
    }
    if (
      readinessError &&
      !flagBoolean(context.flags, "dry-run")
    ) {
      throw new Error(
        `${readinessError} Run the restore with \`--dry-run\` first so the ` +
          "CLI can perform and record the read-only freshness checks.",
      );
    }
    const account = await authenticate(context, accountId);
    if (account.id !== accountId) {
      throw new Error(`This installation belongs to Cloudflare account ${accountId}.`);
    }
    if (readinessError) {
      await repairRemoteRestoreBaseline(context, config);
      readinessError = remoteRestoreTargetReadinessError(config);
      if (readinessError) {
        throw new Error(readinessError);
      }
    }
    const restoreBaseline = config.restoreBaseline!;
    const {
      archiveSha256,
      existingJournal,
      previousMediaMismatch,
      targetFingerprintRefreshed,
    } =
      await withSpinner(
      {
        error: "Remote restore target validation failed",
        start: "Checking the snapshot and fresh remote target",
        success: "Fresh remote restore target validated",
      },
      async (activity) => {
        const archiveSha256 = await sha256File(archive);
        const existingJournal = await readRestoreJournal(config);
        let targetFingerprintRefreshed = false;
        if (existingJournal) {
          validateRestoreJournal(existingJournal, config, archiveSha256);
        } else {
          activity.update("Verifying the remote D1 initialization fingerprint");
          const currentFingerprint = await remoteRestoreFingerprint(
            context.cloudflare,
            config,
          );
          targetFingerprintRefreshed =
            await reverifyRemoteRestoreTargetIfFingerprintChanged({
              currentFingerprint,
              expectedFingerprint: restoreBaseline.fingerprint,
              reverify: async () => {
                activity.update(
                  "The saved fingerprint changed; proving the target is still fresh",
                );
                await assertFreshRemoteRestoreTarget(
                  context,
                  config,
                  activity,
                );
                await saveVerifiedRemoteRestoreBaseline(
                  context,
                  config,
                  activity,
                );
              },
            });
          activity.update("Verifying the remote R2 bucket is empty");
          const existingObjects = await context.cloudflare.listR2Objects(
            accountId,
            config.r2.name,
          );
          if (existingObjects.length > 0) {
            throw new Error("The remote restore target's R2 bucket is not empty.");
          }
        }
        let previousMediaMismatch: string | null | undefined;
        if (existingJournal?.stage === "media-restored") {
          activity.update("Checking media from the previous restore attempt");
          previousMediaMismatch = restoredRemoteMediaMismatch(
            manifest.media.objects,
            await context.cloudflare.listR2Objects(
              accountId,
              config.r2.name,
            ),
          );
        }
        return {
          archiveSha256,
          existingJournal,
          previousMediaMismatch,
          targetFingerprintRefreshed,
        };
      },
    );
    prompts.note([
      `Target instance: ${config.instanceName}`,
      `D1 database: ${config.d1.name} (${config.d1.id})`,
      `R2 bucket: ${config.r2.name}`,
      `Snapshot source: ${manifest.source.instanceName}`,
      `Snapshot migrations: ${manifest.database.migrations.length}`,
      `Pending migrations: ${pending.length}`,
      `R2 objects: ${manifest.media.objectCount}`,
      `Mode: ${existingJournal ? "resume from archived source state" : "fresh restore"}`,
      ...(targetFingerprintRefreshed
        ? ["Target check: saved fingerprint changed; full freshness checks passed"]
        : []),
      ...(previousMediaMismatch === undefined
        ? []
        : [
          `Previous media upload: ${previousMediaMismatch
            ? "differences found; see details below"
            : "matches the snapshot"}`,
        ]),
    ].join("\n"), "Snapshot restore plan");
    if (previousMediaMismatch) {
      prompts.note(
        previousMediaMismatch,
        "Previous media restore differences",
      );
    }
    if (flagBoolean(context.flags, "dry-run")) {
      prompts.outro(
        `Dry run complete. Restore with \`--confirm ${config.instanceName}\`.`,
      );
      return {
        needsLoginSetup: (manifest.database.rowCounts.auth_user ?? 0) === 0,
      };
    }
    if (flagString(context.flags, "confirm") !== config.instanceName) {
      throw new Error(
        `Remote restore requires \`--confirm ${config.instanceName}\` after reviewing the dry run.`,
      );
    }
    const journal: SnapshotRestoreJournal = existingJournal ?? {
      accountId,
      archiveSha256,
      databaseId: config.d1.id,
      instanceId: config.instanceId,
      r2BucketName: config.r2.name,
      stage: "validated",
      startedAt: new Date().toISOString(),
    };
    await writeRestoreJournal(config, journal);
    try {
      await withSpinner(
        {
          error: "Remote snapshot data restore failed",
          start: "Putting the remote target into maintenance mode",
          success: "Remote snapshot data restored and verified",
        },
        async (activity) => {
          const token = randomBytes(32).toString("base64url");
          const endpoint = await deployMaintenanceWorker(
            context,
            config,
            extractedDirectory,
            token,
          );
          activity.update("Waiting for the maintenance Worker to become ready");
          await waitForSnapshotWorker(endpoint, token);
          journal.stage = "maintenance";
          await writeRestoreJournal(config, journal);

          activity.update("Importing the snapshot D1 schema and durable data");
          const currentTables = applicationTablesFromSqlite(
            await databaseTableNames(context.cloudflare, config),
          );
          const restoreSqlPath = path.join(extractedDirectory, "restore.sql");
          await writeFile(restoreSqlPath, buildRestoreSql({
            currentApplicationTables: currentTables,
            dataSql: await readFile(
              path.join(extractedDirectory, manifest.database.data.path),
              "utf8",
            ),
            schemaSql: await readFile(
              path.join(extractedDirectory, manifest.database.schema.path),
              "utf8",
            ),
            snapshotApplicationTables: snapshotApplicationTables(manifest),
          }), {encoding: "utf8", mode: 0o600});
          await dropItemSearchIndexes(context.cloudflare, config);
          await context.cloudflare.executeSqlFile(config, restoreSqlPath);
          activity.update("Verifying imported D1 row counts and indexes");
          await verifyImportedRowCounts(context.cloudflare, config, manifest);
          await restoreSnapshotIndexes(
            context.cloudflare,
            config,
            manifest,
            extractedDirectory,
          );
          journal.stage = "database-imported";
          await writeRestoreJournal(config, journal);
          activity.update("Applying newer D1 migrations");
          await context.cloudflare.applyMigrations(config);
          await prepareItemSearch(context.cloudflare, config);
          const finalizationSqlPath = path.join(
            extractedDirectory,
            "finalize.sql",
          );
          await writeFile(
            finalizationSqlPath,
            buildRestoreFinalizationSql(config.instanceId),
            {encoding: "utf8", mode: 0o600},
          );
          activity.update("Recreating target-specific installation state");
          await context.cloudflare.executeSqlFile(config, finalizationSqlPath);
          journal.stage = "migrations-applied";
          await writeRestoreJournal(config, journal);

          activity.update("Preparing the remote R2 media restore");
          await context.cloudflare.emptyR2Bucket(accountId, config.r2.name);
          for (const [index, object] of manifest.media.objects.entries()) {
            activity.update(
              `Restoring R2 media: object ${index + 1} of ${
                manifest.media.objectCount
              }`,
            );
            await uploadRemoteObject(
              endpoint,
              token,
              extractedDirectory,
              object,
            );
          }
          journal.stage = "media-restored";
          await writeRestoreJournal(config, journal);
          activity.update("Verifying the restored remote D1 and R2 data");
          await verifyRestoredDatabase(context.cloudflare, config, manifest);
          await verifyRestoredRemoteMedia(
            context.cloudflare,
            config,
            manifest.media.objects,
            (delay) => activity.update(
              "Waiting for Cloudflare's R2 inventory to reflect the " +
                `completed uploads; checking again in ${
                  Math.ceil(delay / 1_000)
                }s`,
            ),
          );
          journal.stage = "verified";
          await writeRestoreJournal(config, journal);
        },
      );

      await deployConfiguredProject(context, config, false);
      markStep(config, "snapshot-restored");
      await writeConfig(config);
      await unlink(restoreJournalPath(config));
    } catch (error) {
      throw new Error(
        `${errorMessage(error)}\n\nThe target remains in maintenance mode. ` +
          `Fix the cause and rerun the same command with the same archive and ` +
          `\`--confirm ${config.instanceName}\`; it will restart from the archived schema and data.`,
      );
    }
    return {
      needsLoginSetup: (manifest.database.rowCounts.auth_user ?? 0) === 0,
    };
  } finally {
    await rm(extractedDirectory, {force: true, recursive: true});
  }
}

export async function snapshotCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const action = flagString(flags, "action");
  if (!action || !["create", "pull", "restore"].includes(action)) {
    throw new Error(
      "Snapshot action must be create, pull, or restore. Run `yarn manage help snapshot`.",
    );
  }
  if (flagBoolean(flags, "preview")) {
    throw new Error("Portable snapshots support production instances only.");
  }
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  if (action === "create") {
    if (flagBoolean(flags, "local")) {
      throw new Error("Snapshot create exports a Cloudflare instance; remove --local.");
    }
    await resolveCommandInstance(context);
    const output = snapshotOutputPath(flags, context.instanceName!);
    prompts.intro("Create portable microfeed snapshot");
    await createRemoteSnapshotWithProgress(context, output);
    prompts.outro(snapshotCreatedMessage(output));
    return;
  }
  if (action === "pull") {
    if (flagBoolean(flags, "local")) {
      throw new Error("Snapshot pull already creates a local target; remove --local.");
    }
    await resolveCommandInstance(context);
    const localInstance = flagString(flags, "local-instance");
    if (!localInstance) {
      throw new Error("Snapshot pull requires --local-instance <new-name>.");
    }
    const requestedOutput = flagString(flags, "output");
    const temporaryDirectory = requestedOutput
      ? null
      : await mkdtemp(path.join(tmpdir(), "microfeed-snapshot-pull-"));
    const output = requestedOutput
      ? path.resolve(requestedOutput)
      : path.join(temporaryDirectory!, "snapshot.tar.gz");
    prompts.intro("Pull Cloudflare instance into a local snapshot");
    let restoreResult!: {needsLoginSetup: boolean};
    try {
      await createRemoteSnapshotWithProgress(context, output);
      restoreResult = await restoreSnapshotLocallyWithProgress(
        output,
        localInstance,
        runner,
      );
    } finally {
      if (temporaryDirectory) {
        await rm(temporaryDirectory, {force: true, recursive: true});
      }
    }
    prompts.outro(
      `Local instance ${localInstance} is ready.\n\n` +
        localSnapshotNextSteps(
          localInstance,
          restoreResult.needsLoginSetup,
        ),
    );
    return;
  }
  const archive = flagString(flags, "file");
  if (!archive) {
    throw new Error("Snapshot restore requires --file <backup.tar.gz>.");
  }
  const resolvedArchive = path.resolve(archive);
  await stat(resolvedArchive).catch(() => {
    throw new Error(`Snapshot file was not found: ${resolvedArchive}.`);
  });
  if (flagBoolean(flags, "local")) {
    if (flagBoolean(flags, "dry-run") || flags.confirm !== undefined) {
      throw new Error("--dry-run and --confirm apply only to remote snapshot restore.");
    }
    const targetInstance = flagString(flags, "instance");
    if (!targetInstance) {
      throw new Error("Local snapshot restore requires --instance <new-name>.");
    }
    prompts.intro("Restore portable snapshot locally");
    const restoreResult = await restoreSnapshotLocallyWithProgress(
      resolvedArchive,
      targetInstance,
      runner,
    );
    prompts.outro(
      "Local restore complete.\n\n" +
        localSnapshotNextSteps(
          targetInstance,
          restoreResult.needsLoginSetup,
        ),
    );
    return;
  }
  if (flagBoolean(flags, "dry-run") && flags.confirm !== undefined) {
    throw new Error("Use either --dry-run or --confirm for remote restore, not both.");
  }
  await resolveCommandInstance(context);
  prompts.intro("Restore portable snapshot to Cloudflare");
  const restoreResult = await restoreSnapshotRemotely(
    context,
    resolvedArchive,
  );
  if (!flagBoolean(flags, "dry-run")) {
    prompts.outro(remoteSnapshotNextSteps(
      context.instanceName!,
      restoreResult.needsLoginSetup,
    ));
  }
}
