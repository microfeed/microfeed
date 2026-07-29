import {createHash, randomBytes, randomUUID} from "node:crypto";
import {mkdtemp, rmdir, unlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import type {AdminAuthMode} from "@/shared/AdminAuth";
import {
  adminBasePath,
  adminUrl,
  normalizeAdminPath,
  validateAdminPath,
} from "@/shared/AdminPath";
import {ADMIN_SETUP_SECRET_NAMES} from "@/shared/AdminCredentials";
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
  instanceSummaries,
  isLocalOnly,
  listLocalInstances,
  localPersistencePath,
  markStep,
  normalizeLocalInstanceName,
  readConfig,
  removeSavedInstance,
  setActiveInstance,
  validateLocalInstanceName,
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
  pagesCollisionMessage,
  pagesDomainAttachedMessage,
  pagesDomainIsAttached,
} from "./lib/cloudflare";
import {
  openUrl,
  runCommand,
  runYarnScript,
} from "./lib/process";
import {
  askConfirm,
  askPassword,
  askText,
  chooseAccount,
  chooseAdminAuthSetup,
  chooseAuthAction,
  chooseLocalInstance,
  choosePagesProject,
  prompts,
} from "./lib/prompts";

export type FlagValue = boolean | string;
export type Flags = Record<string, FlagValue>;

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
          "`--instance <name>` or run `yarn admin use <name>`.",
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
      "`yarn admin setup --local --instance <name>` for local development, " +
      "or `yarn admin setup --instance <name>` for Cloudflare.",
  );
}

function instanceTargetMessage(config: MicrofeedConfig): string {
  return [
    `Instance: ${config.instanceName}`,
    `Worker: ${workerName(config)}`,
    `D1: ${config.d1.name}`,
    `R2: ${config.r2.name}`,
    ...(config.customDomain ? [`Domain: ${config.customDomain}`] : []),
  ].join("\n");
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
  defaultValue: string,
): Promise<string> {
  const fromFlag = flagString(flags, flag);
  const value = fromFlag ?? await askText(message, defaultValue);
  const error = flag === "d1-name"
    ? validateD1Name(value)
    : flag === "r2-name"
      ? validateR2Name(value)
      : validateResourceName(value);
  if (error) {
    throw new Error(`${value}: ${error}`);
  }
  return value;
}

async function configuredAdminPath(
  flags: Flags,
  defaultValue = "admin",
): Promise<string> {
  const value = flagString(flags, "admin-path") ??
    await askText("Admin path", defaultValue);
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
      "projects and never changes or deletes them.",
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
          "`yarn admin accounts --reauthorize`, then try again.",
      );
    }
    return account;
  }
  if (flagBoolean(context.flags, "yes") && accounts.length > 1) {
    throw new Error(
      "Multiple Cloudflare accounts are available. Run `yarn admin " +
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
    "not expose a pages:read OAuth scope. `yarn admin accounts` only reads " +
    "your identity and account list; it never changes Cloudflare resources.";
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

  let identity: CloudflareIdentity;
  let scopesGranted: boolean;
  if (flagBoolean(flags, "reauthorize")) {
    explainAuthorization();
    await context.cloudflare.login();
    identity = await context.cloudflare.identity();
    scopesGranted = identity.accounts.length > 0 &&
      await context.cloudflare.hasRequiredScopes();
  } else {
    identity = await context.cloudflare.identity();
    scopesGranted = identity.accounts.length > 0 &&
      await context.cloudflare.hasRequiredScopes();
    if (identity.accounts.length === 0 || !scopesGranted) {
      explainAuthorization();
      await context.cloudflare.login();
      identity = await context.cloudflare.identity();
      scopesGranted = identity.accounts.length > 0 &&
        await context.cloudflare.hasRequiredScopes();
    }
  }

  if (identity.accounts.length === 0) {
    throw new Error(
      "Cloudflare did not return any accounts for this login. No " +
        "Cloudflare resources were changed. Use `yarn admin accounts " +
        "--reauthorize` to sign in with another Cloudflare user.",
    );
  }
  if (!scopesGranted) {
    throw new Error(
      "Cloudflare authorization did not grant all permissions microfeed " +
        "needs. No Cloudflare resources were changed. Run `yarn admin " +
        "accounts --reauthorize` and approve every requested permission.",
    );
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
    return;
  }
  prompts.intro("Cloudflare accounts available to microfeed");
  prompts.log.info(
    `Login: ${identity.email ?? "not reported"}\n` +
      `Wrangler profile: ${identity.profile ?? "default or not reported"}`,
  );
  for (const account of identity.accounts) {
    prompts.log.info(`${account.name} — ${account.id}`);
  }
  prompts.outro(
    identity.accounts.length === 1
      ? "One account is available; microfeed can use it automatically."
      : "Choose one of these accounts when deploying. Account names may " +
        "repeat, so the full ID is the reliable identifier.",
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
  const spinner = prompts.spinner();
  spinner.start("Generating Worker binding types");
  await runYarnScript(runner, "types", {env});
  spinner.message("Checking TypeScript and Astro");
  await runYarnScript(runner, "typecheck", {env});
  spinner.message("Running tests");
  await runYarnScript(runner, "test", {env});
  spinner.message("Building the Worker");
  await runYarnScript(runner, "build", {env});
  spinner.stop("Checks and build passed");
}

async function withEphemeralSecretFile<T>(
  includeBetterAuthSecret: boolean,
  includeUploadSigningKey: boolean,
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
      "The first admin login requires an email and a hidden password prompt. " +
      "Run this command again without --yes.",
    );
  }
  prompts.note(
    "Create the account you will use to sign in to the microfeed admin " +
      "dashboard. The owner is the first administrator and has full control " +
      "of this microfeed. This email does not need to match your Cloudflare " +
      "account and is not shown publicly.",
    "Set up admin login",
  );
  const emailInput = flagString(context.flags, "owner-email") ??
    await askText("Admin login email");
  const emailError = validateOwnerEmail(emailInput);
  if (emailError) {
    throw new Error(emailError);
  }
  const email = normalizeOwnerEmail(emailInput);
  const password = await promptForPassword("Admin login password");
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
  const email = context.pendingAdminEmail ?? await adminEmailInput(context);
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
    if (options.verifyAdminLogin) {
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
      if (loginResponse.status !== 200) {
        throw new Error(
          `The admin login check at ${loginUrl.href} returned ` +
            `HTTP ${loginResponse.status}.`,
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

async function initializeAdminFromDeployment(
  baseUrl: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const bootstrapUrl = new URL(
    "/.well-known/microfeed/bootstrap-admin/",
    baseUrl,
  );
  try {
    const response = await fetch(bootstrapUrl, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        "Admin login could not be initialized. Check the admin email, " +
          "password, and confirmation secrets in Cloudflare, then retry " +
          `the deployment. The setup endpoint returned HTTP ${response.status}.`,
      );
    }
    const data = await response.json() as {status?: string};
    if (
      data.status !== "created" &&
      data.status !== "already_initialized"
    ) {
      throw new Error(
        "Admin login could not be initialized. Check the admin email, " +
          "password, and confirmation secrets in Cloudflare, then retry " +
          "the deployment.",
      );
    }
  } finally {
    clearTimeout(timeout);
  }
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

export function accessApplicationDashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${accountId}/one/access-controls/apps/self-hosted/add`;
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
    "the built-in login later with `yarn admin auth setup`.";
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
      message: `The built-in admin login protects ${adminUrl}. Run ` +
        "`yarn admin access` if you also want Cloudflare Access as a " +
        "second gate.",
      title: "✅ Admin dashboard protected",
    };
  }
  return {
    message: builtInAuthEnabled
      ? `The built-in login is configured, but an anonymous request to ` +
        `${adminUrl} did not reach either its login page or Cloudflare ` +
        "Access. Run `yarn admin status` to investigate before using the " +
        "dashboard."
      : `The admin dashboard at ${adminUrl} is public. Run ` +
        "`yarn admin access` now, or add the built-in login with " +
        "`yarn admin auth setup`.",
    title: builtInAuthEnabled
      ? "Warning: admin protection could not be verified"
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
        "the risk and plan to protect the admin path with Cloudflare Zero " +
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
): Promise<MicrofeedConfig> {
  await configureAdminAuth(context, config);
  await generateWranglerConfig(config);
  if (initializeAdmin) {
    await collectInitialAdminSetupEmail(context, config);
  }
  await context.cloudflare.applyMigrations(config);
  markStep(config, "migrations-applied");
  await writeConfig(config);
  if (initializeAdmin) {
    await prepareInitialAdminSetup(context, config);
  }
  await runChecks(context.runner, config);

  const needsAuthSecret = adminAuthMode(config) === "built-in" &&
    !config.completedSteps.includes("better-auth-secret-created");
  const needsUploadSigningSecret = includeNewSigningSecret &&
    !config.completedSteps.includes("upload-signing-secret-created") &&
    !config.completedSteps.includes("worker-deployed");
  const deploymentUrl = needsAuthSecret || needsUploadSigningSecret
    ? await withEphemeralSecretFile(
        needsAuthSecret,
        needsUploadSigningSecret,
        (filename) => context.cloudflare.deploy(config, filename),
      )
    : await context.cloudflare.deploy(config);
  config.deploymentUrl = deploymentUrl ?? config.deploymentUrl;
  if (needsAuthSecret) {
    markStep(config, "better-auth-secret-created");
  }
  if (needsUploadSigningSecret) {
    markStep(config, "upload-signing-secret-created");
  }
  markStep(config, "worker-deployed");
  await writeConfig(config);

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
  const previous = structuredClone(config);
  config.adminAuthMode = nextMode;
  await operations.write(config);
  try {
    await operations.deploy(config);
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

async function setupFresh(context: CommandContext): Promise<void> {
  const saved = await readConfig(false, context.instanceName);
  if (saved && isLocalOnly(saved)) {
    throw new Error(
      `Instance \`${saved.instanceName}\` is local only. Keep using it with ` +
        `\`yarn dev --instance ${saved.instanceName}\`, or choose a new ` +
        "instance name for the Cloudflare deployment.",
    );
  }
  const account = await authenticate(
    context,
    saved && !isLocalOnly(saved) ? cloudflareAccountId(saved) : undefined,
  );
  const projectDefault = flagString(context.flags, "project-name") ??
    process.env.CLOUDFLARE_PROJECT_NAME ??
    saved?.projectName ??
    context.instanceName ??
    "microfeed";
  const projectName = await resourceName(
    context.flags,
    "project-name",
    "Worker project name",
    projectDefault,
  );
  if (saved && saved.projectName !== projectName) {
    throw new Error(
      `Instance \`${saved.instanceName}\` already manages ` +
        `Worker \`${workerName(saved)}\`. Create another instance with ` +
        `\`yarn admin setup --instance ${normalizeLocalInstanceName(
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
  const r2Name = await resourceName(
    context.flags,
    "r2-name",
    "R2 bucket name",
    saved?.projectName === projectName
      ? saved.r2.name
      : `${projectName}-media`,
  );
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
    "Setup target",
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
    throw new Error(
      `A Worker named \`${projectName}\` already exists. microfeed will not ` +
      "overwrite an unrelated Worker. Choose a different project name.",
    );
  }

  const [databases, r2Exists] = await Promise.all([
    context.cloudflare.d1Databases(account.id),
    context.cloudflare.r2BucketExists(account.id, r2Name),
  ]);
  const existingD1 = databases.find(({name}) => name === d1Name);
  const d1Resumed = Boolean(
    relatedSavedState &&
    saved.completedSteps.includes("d1-ready") &&
    saved.d1.name === d1Name,
  );
  const reuseD1 = existingD1
    ? await explicitReuse(
        context.flags,
        "reuse-d1",
        `D1 database \`${d1Name}\``,
        d1Resumed,
      )
    : false;
  if (existingD1 && !reuseD1) {
    throw new Error("Setup stopped before changing any Cloudflare resources.");
  }

  const r2Resumed = Boolean(
    relatedSavedState &&
    saved.completedSteps.includes("r2-ready") &&
    saved.r2.name === r2Name,
  );
  const reuseR2 = r2Exists
    ? await explicitReuse(
        context.flags,
        "reuse-r2",
        `R2 bucket \`${r2Name}\``,
        r2Resumed,
      )
    : false;
  if (r2Exists && !reuseR2) {
    throw new Error("Setup stopped before changing any Cloudflare resources.");
  }

  const config: MicrofeedConfig = relatedSavedState && saved
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
        r2: {name: r2Name, reuse: reuseR2},
      };
  context.instanceName = config.instanceName;
  config.adminPath = adminPath;
  config.d1.name = d1Name;
  config.d1.reuse = reuseD1;
  config.r2.name = r2Name;
  config.r2.reuse = reuseR2;
  await setActiveInstance(context.instanceName);
  await writeConfig(config);

  if (existingD1) {
    config.d1.id = existingD1.id;
  } else {
    prompts.log.step(`Creating D1 database ${d1Name}`);
    config.d1.id = await context.cloudflare.createD1(account.id, d1Name);
  }
  markStep(config, "d1-ready");
  await writeConfig(config);

  if (!r2Exists) {
    prompts.log.step(`Creating R2 bucket ${r2Name}`);
    await context.cloudflare.createR2(account.id, r2Name);
  }
  markStep(config, "r2-ready");
  await writeConfig(config);

  await deployConfiguredProject(context, config, true, true);
  prompts.log.success(`microfeed is live at ${config.deploymentUrl}`);

  if (!flagBoolean(context.flags, "yes")) {
    if (adminAuthMode(config) !== "built-in") {
      prompts.note(
        `The admin dashboard at ${new URL(
          adminBasePath(config.adminPath),
          config.deploymentUrl!,
        ).href} is public. Protect it now with ` +
        "`yarn admin access`, or add the built-in login later with " +
        "`yarn admin auth setup`.",
        "Warning: admin authentication skipped",
      );
    }
    if (await askConfirm("Configure a custom domain now?", true)) {
      await domainCommand(context);
    } else {
      prompts.note(
        "Your workers.dev address remains available. Add a custom domain " +
        "at any time with `yarn admin domain`.",
        "Custom domain skipped",
      );
    }
  }
  await finishInitialAdminSetup(context, config);
}

async function setupPreview(context: CommandContext): Promise<void> {
  const production = await readConfig(false, context.instanceName);
  if (!production) {
    throw new Error(
      "Set up the production environment first with " +
      "`yarn admin setup`, then run `yarn admin setup --preview`.",
    );
  }
  if (isLocalOnly(production)) {
    throw new Error(
      `Instance \`${production.instanceName}\` is local only and cannot ` +
        "have a Cloudflare preview environment. Select a managed Cloudflare " +
        "instance first.",
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
      "Preview setup stopped before changing any Cloudflare resources.",
    );
  }
  const existingD1 = databases.find(({name}) => name === d1Name);
  const d1Resumed = Boolean(
    relatedSavedState &&
    savedForWorker?.completedSteps.includes("d1-ready") &&
    savedForWorker.d1.name === d1Name,
  );
  const reuseD1 = existingD1
    ? await explicitReuse(
        context.flags,
        "reuse-d1",
        `D1 database \`${d1Name}\``,
        d1Resumed,
      )
    : false;
  if (existingD1 && !reuseD1) {
    throw new Error(
      "Preview setup stopped before changing any Cloudflare resources.",
    );
  }

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
        r2: {name: production.r2.name, reuse: true},
        workerName: previewWorkerName,
      };
  config.adminPath = adminPath;
  config.d1.name = d1Name;
  config.d1.reuse = reuseD1;
  config.r2 = {name: production.r2.name, reuse: true};
  config.workerName = previewWorkerName;
  await writeConfig(config);

  if (existingD1) {
    config.d1.id = existingD1.id;
  } else {
    prompts.log.step(`Creating preview D1 database ${d1Name}`);
    config.d1.id = await context.cloudflare.createD1(account.id, d1Name);
  }
  markStep(config, "d1-ready");
  await writeConfig(config);

  await deployConfiguredProject(context, config, true, true);
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
          ).href} is public. Run \`yarn admin access --preview\` to ` +
          "protect it.",
      adminAuthMode(config) === "built-in"
        ? "Preview admin login ready"
        : "Warning: preview authentication skipped",
    );
  }
}

async function localSetupInstanceName(flags: Flags): Promise<string> {
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
    confirmation: "Set up a built-in admin email and password now?",
    message:
      "Built-in email and password authentication is optional for local " +
      "development. Set it up now to try the production sign-in flow, " +
      "or add it later with " +
      `\`yarn admin auth setup --local --instance ${instanceName}\`.\n\n` +
      "For production, we strongly recommend protecting `/admin/` with " +
      "the built-in login, Cloudflare Zero Trust Access, or both.",
    title: "Optional local admin login",
  };
}

async function setupLocal(context: CommandContext): Promise<void> {
  const targetName = await localSetupInstanceName(context.flags);
  context.instanceName = targetName;
  const existingConfig = await readConfig(false, targetName);
  const config = await ensureLocalOnlyConfig(targetName);
  await setActiveInstance(targetName);
  prompts.note(
    [
      `Instance: ${targetName}`,
      "Type: Local only",
      `D1: ${config.d1.name} (local simulation)`,
      `R2: ${config.r2.name} (local simulation)`,
      "Cloudflare resources: none",
    ].join("\n"),
    "Local setup target",
  );
  await context.cloudflare.applyLocalMigrations(config);

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
      "Built-in admin login remains disabled for this local instance. " +
        `Add it with \`yarn admin auth setup --local --instance ${targetName}\`.`,
    );
    return;
  }
  if (
    existingOwner &&
    adminAuthMode(config) === "built-in" &&
    requestedMode !== "none"
  ) {
    prompts.log.success(`Local admin login ready for ${existingOwner.email}.`);
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
        `\`yarn admin auth setup --local --instance ${targetName}\`.`,
      "Built-in admin login skipped",
    );
    return;
  }

  const owner = await ensureAuthOwner(context, config, true);
  if (adminAuthMode(config) === "none") {
    config.adminAuthMode = "built-in";
    await writeConfig(config);
    await generateWranglerConfig(config);
  }
  prompts.log.success(`Local admin login ready for ${owner.email}.`);
}

export async function setupCommand(
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
  if (local && preview) {
    throw new Error(
      "`--local` and `--preview` cannot be used together. Local instances " +
        "already use isolated development data.",
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
        "local setup interactively so the password stays hidden.",
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
      ? "microfeed local instance setup"
      : preview
      ? "microfeed preview environment setup"
      : "microfeed first-time setup",
  );
  if (local) {
    await setupLocal(context);
  } else if (preview) {
    await setupPreview(context);
  } else {
    await setupFresh(context);
  }
  prompts.outro(
    local
      ? `Local setup complete. Start it with \`yarn dev --instance ${
        context.instanceName ?? "local"
      }\`.`
      : preview
      ? "Preview setup complete. Update it with " +
        "`yarn admin deploy --preview`."
      : "Setup complete. Future releases use `yarn admin deploy`.",
  );
}

async function deployFromWorkersBuild(
  context: CommandContext,
): Promise<void> {
  process.stdout.write(
    "Applying D1 migrations with Cloudflare Workers Builds...\n",
  );
  await context.cloudflare.applyMigrationsByBinding("FEED_DB");
  const owner = await context.cloudflare.authOwnerByBinding("FEED_DB");
  const secretNames = await context.cloudflare.workerSecretNamesFromBuild();
  const setupSecretNames = ADMIN_SETUP_SECRET_NAMES.filter(
    (name) => secretNames.has(name),
  );
  if (!owner && setupSecretNames.length !== ADMIN_SETUP_SECRET_NAMES.length) {
    throw new Error(
      "Built-in admin authentication has no administrator yet. Add the " +
        "admin email, password, and password confirmation secrets in " +
        "Cloudflare, then retry the deployment.",
    );
  }

  const needsBetterAuthSecret = !secretNames.has("BETTER_AUTH_SECRET");
  const needsUploadSigningKey = !secretNames.has("UPLOAD_SIGNING_KEY");
  process.stdout.write("Deploying microfeed with Cloudflare Workers Builds...\n");
  const deploymentUrl = needsBetterAuthSecret || needsUploadSigningKey
    ? await withEphemeralSecretFile(
        needsBetterAuthSecret,
        needsUploadSigningKey,
        (filename) => context.cloudflare.deployFromWorkersBuild(filename),
      )
    : await context.cloudflare.deployFromWorkersBuild();
  if (!deploymentUrl) {
    throw new Error(
      "Wrangler deployed successfully but did not report a workers.dev URL.",
    );
  }

  if (!owner) {
    process.stdout.write("Initializing the admin login...\n");
    await initializeAdminFromDeployment(deploymentUrl);
  }

  if (setupSecretNames.length > 0) {
    process.stdout.write("Removing temporary admin setup values...\n");
    try {
      await context.cloudflare.deleteWorkerSecretsFromBuild(setupSecretNames);
    } catch {
      throw new Error(
        "The admin login is ready, but Cloudflare could not remove the " +
          "temporary setup values. Retry this deployment to finish cleanup.",
      );
    }
  }

  await verifyDeployment(null, deploymentUrl, {
    adminPath: "admin",
    runner: context.runner,
    verifyAdminLogin: true,
  });
  process.stdout.write(`Deployed and verified ${deploymentUrl}\n`);
}

export async function deployCommand(
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
  if (
    flagBoolean(flags, "cloudflare-build") &&
    process.env.WORKERS_CI !== "1"
  ) {
    throw new Error(
      "`--cloudflare-build` is reserved for Cloudflare Workers Builds. " +
      "Use `yarn admin deploy` from this repository.",
    );
  }
  if (process.env.WORKERS_CI === "1") {
    if (preview) {
      throw new Error(
        "The guided preview environment uses local saved state. Run " +
        "`yarn admin deploy --preview` from the configured clone.",
      );
    }
    await deployFromWorkersBuild(context);
    return;
  }
  prompts.intro(
    preview ? "microfeed preview deployment" : "microfeed deployment",
  );
  await resolveCommandInstance(context);
  const config = await ensureWranglerConfig(
    false,
    preview,
    context.instanceName,
  );
  const accountId = cloudflareAccountId(config);
  prompts.note(instanceTargetMessage(config), "Deployment target");
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error(
      `This installation belongs to Cloudflare account ${accountId}.`,
    );
  }
  const pages = await context.cloudflare.pagesProjects(accountId);
  const targetWorkerName = workerName(config);
  if (pages.includes(targetWorkerName)) {
    throw new Error(pagesCollisionMessage(targetWorkerName));
  }
  await deployConfiguredProject(context, config, false);
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
    r2: {name: r2Name, reuse: true},
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
          ).href} is public. Run \`yarn admin access\` before using it, ` +
          "or add the built-in login with `yarn admin auth setup`.",
      adminAuthMode(config) === "built-in"
        ? "Admin login setup"
        : "Warning: admin authentication skipped",
    );
  }
  prompts.note(
    "Keep Pages online while you verify public pages, JSON/RSS feeds, " +
    "admin edits, uploads, and existing media. For a custom domain, run " +
    "`yarn admin domain`. If it is still attached to Pages, the command links " +
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
        `No changes were made. Run \`yarn admin domain\` again after ` +
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
        "Run `yarn admin access` whenever you are ready.",
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
  const accountId = cloudflareAccountId(config);
  const targetWorkerName = workerName(config);
  prompts.intro(
    `microfeed ${preview ? "preview " : ""}status: ${targetWorkerName}`,
  );
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  const [worker, databases, r2] = await Promise.all([
    context.cloudflare.workerExists(accountId, targetWorkerName),
    context.cloudflare.d1Databases(accountId),
    context.cloudflare.r2BucketExists(accountId, config.r2.name),
  ]);
  const d1 = databases.some(
    ({id, name}) => id === config.d1.id && name === config.d1.name,
  );
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
  if (r2) {
    prompts.log.success(`R2 ${config.r2.name}: bound resource found`);
  } else {
    prompts.log.error(`R2 ${config.r2.name}: missing`);
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
    prompts.log.success(`Admin owner: ${owner.email}`);
    if (passwordSetup?.purpose === "reset") {
      prompts.log.warn(
        passwordSetupActive
          ? `A one-time password-reset link is active until ${
              passwordSetup.expiresAt
            }. The current login remains active until it is used.`
          : "An expired password-reset link remains recorded. Create a new " +
            "one with `yarn admin auth reset-password` if needed.",
      );
    }
  } else {
    prompts.log.warn("Admin owner: waiting for browser password setup");
    if (passwordSetupActive) {
      prompts.log.info(
        `One-time password setup is pending for ${passwordSetup!.email} ` +
          `until ${passwordSetup!.expiresAt}. The dashboard is locked.`,
      );
    } else if (passwordSetup) {
      prompts.log.error(
        "The password setup link expired. Generate a replacement with " +
          "`yarn admin auth setup`.",
      );
    } else {
      prompts.log.error(
        "No password setup link exists. Generate one with " +
          "`yarn admin auth setup`.",
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
  if (!worker || !d1 || !r2) {
    throw new Error("One or more required Cloudflare resources are missing.");
  }
  if (builtInAuthEnabled && !owner) {
    throw new Error(
      !pendingDashboardLocked
        ? "Deployment is reachable, but the dashboard was not safely locked " +
          "with HTTP 403. Run `yarn admin deploy`, then check status again."
        : passwordSetupActive
        ? "Deployment is healthy and the dashboard is safely locked. Open " +
          "the one-time link printed by setup to create the password, then " +
          "run `yarn admin status` again."
        : "Deployment is healthy and the dashboard is safely locked, but a " +
          "usable password link is missing. Run `yarn admin auth setup`.",
    );
  }
  prompts.outro(
    verifiedAdminProtection
      ? "Status checks passed."
      : (
        builtInAuthEnabled
          ? "Status checks completed, but admin protection was not verified."
          : "Status checks passed with a public admin dashboard warning."
      ),
  );
}

interface DestroyInspection {
  d1Exists: boolean;
  domains: Awaited<ReturnType<CloudflareClient["workerDomains"]>>;
  r2Exists: boolean;
  workerExists: boolean;
}

const DESTROY_WORKER_STEP = "destroy-worker-deleted";
const DESTROY_DOMAINS_STEP = "destroy-domains-detached";
const DESTROY_D1_STEP = "destroy-d1-deleted";
const DESTROY_R2_STEP = "destroy-r2-deleted";

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
  const [workerExists, databases, r2Exists, domains] = await Promise.all([
    context.cloudflare.workerExists(accountId, targetWorkerName),
    context.cloudflare.d1Databases(accountId),
    context.cloudflare.r2BucketExists(accountId, config.r2.name),
    context.cloudflare.workerDomains(accountId, targetWorkerName),
  ]);

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
      discovered.r2Name !== config.r2.name
    ) {
      throw new Error(
        `Worker \`${targetWorkerName}\` no longer matches this saved ` +
          "microfeed installation. No resources were deleted. Inspect its " +
          "bindings and MICROFEED_INSTANCE_ID in the Worker dashboard.",
      );
    }
  }

  return {d1Exists, domains, r2Exists, workerExists};
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
  const r2Action = config.r2.reuse
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
      "yarn admin destroy does not accept --yes. Use the interactive typed " +
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
  if (!preview && await readConfig(true, config.instanceName)) {
    throw new Error(
      `Site ${config.instanceName} still has a preview deployment. ` +
        "Destroy it first with yarn admin destroy --preview --instance " +
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

export async function authCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  const local = flagBoolean(flags, "local");
  const preview = flagBoolean(flags, "preview");
  await resolveCommandInstance(context, local);
  const config = await ensureWranglerConfig(
    local,
    preview,
    context.instanceName,
  );
  const requestedAction = flagString(flags, "action");
  const action = requestedAction ??
    (
      local
        ? "setup"
        : await chooseAuthAction(adminAuthMode(config) === "none")
    );
  const supportedActions = new Set([
    "change-email",
    "change-path",
    "disable",
    "reset-password",
    "setup",
  ]);
  if (!supportedActions.has(action)) {
    throw new Error(`Unknown auth action: ${action}`);
  }
  if (
    flags["admin-password"] !== undefined &&
    action !== "setup" &&
    action !== "reset-password"
  ) {
    throw new Error(
      "`--admin-password` is supported only by `auth setup` and " +
        "`auth reset-password`.",
    );
  }
  if (local) {
    if (flags["admin-password"] !== undefined) {
      throw new Error(
        "`--admin-password` is not supported for local instances. Run the " +
        "local setup interactively so the password stays hidden.",
      );
    }
    validateUnsafeAdminPasswordFlag(flags);
    if (action !== "setup") {
      throw new Error(
        "Local authentication supports `yarn admin auth setup --local`. " +
        "Use the production or preview command for account changes.",
      );
    }
    await context.cloudflare.applyLocalMigrations(config);
    const owner = await ensureAuthOwner(context, config, true);
    if (adminAuthMode(config) === "none") {
      config.adminAuthMode = "built-in";
      await writeConfig(config);
      await generateWranglerConfig(config);
    }
    prompts.outro(`Local admin login ready for ${owner.email}.`);
    return;
  }
  validateUnsafeAdminPasswordFlag(flags);
  const accountId = cloudflareAccountId(config);

  prompts.intro(
    `microfeed ${preview ? "preview " : ""}admin login`,
  );
  const account = await authenticate(context, accountId);
  if (account.id !== accountId) {
    throw new Error("Logged in to the wrong Cloudflare account.");
  }
  if (action === "disable") {
    if (adminAuthMode(config) === "none") {
      prompts.outro("The built-in admin login is already disabled.");
      return;
    }
    const verificationUrl = deploymentVerificationUrl(config);
    if (!verificationUrl) {
      throw new Error(
        "Deploy microfeed before disabling the built-in admin login.",
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
    await finishInitialAdminSetup(context, config);
    prompts.outro(
      await context.cloudflare.authOwner(config)
        ? "Admin login is ready."
        : "Deployment is ready; finish creating the password in your browser.",
    );
    return;
  }
  await context.cloudflare.applyMigrations(config);
  const owner = await context.cloudflare.authOwner(config);
  if (!owner) {
    throw new Error(
      "No owner login exists. Run `yarn admin auth setup` first.",
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
    prompts.outro("The admin path is unchanged.");
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
    `Admin login moved to ${adminBasePath(config.adminPath)}. ` +
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
          `    R2: ${config.r2.name} (local simulation)`,
          `    URL: ${config.deploymentUrl ?? "http://localhost:4321"}`,
        ]
      : [
          `    Worker: ${workerName(config)}`,
          `    D1: ${config.d1.name}`,
          `    R2: ${config.r2.name}`,
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
  const instanceName = normalizeLocalInstanceName(worker.workerName);
  const url = worker.customDomains[0]
    ? `https://${worker.customDomains[0]}`
    : worker.workersDevUrl ?? "no public URL";
  return [
    `◇ ${worker.workerName}`,
    "    Type: Cloudflare — available to connect",
    `    D1: ${worker.d1.name}`,
    `    R2: ${worker.r2Name}`,
    `    URL: ${url}`,
    "    Connect: " +
      `yarn admin connect --account-id ${worker.accountId} ` +
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
        "Run `yarn admin connect` to sign in and connect an existing Worker.",
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

  const lines: string[] = [];
  appendSection(lines, [
    "=== Local ===",
    ...(local.length > 0
      ? instanceRecordLines(local.map(({active, config, name}) =>
          connectedInstanceLines(active, config, name)
        ))
      : ["No local-only instances."]),
  ]);
  const sortedGroups = [...groups.values()].sort((left, right) =>
    left.accountName.localeCompare(right.accountName) ||
    left.accountId.localeCompare(right.accountId)
  );
  for (const group of sortedGroups) {
    const records = [
      ...group.managed
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(({active, config, name}) =>
          connectedInstanceLines(active, config, name)
        ),
      ...group.available
        .sort((left, right) =>
          left.workerName.localeCompare(right.workerName)
        )
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
        "`yarn admin setup --local --instance <name>`.",
      "Create a Cloudflare deployment with " +
        "`yarn admin setup --instance <name>`.",
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
  const context: CommandContext = {
    cloudflare: new CloudflareClient(runner),
    flags,
    instanceName: undefined,
    runner,
  };
  prompts.intro("Connect an existing Cloudflare microfeed");
  const account = await authenticate(context);
  const workers = await context.cloudflare.discoverMicrofeedWorkers(account);
  if (workers.length === 0) {
    throw new Error(
      "No compatible microfeed Workers were found in this Cloudflare account.",
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

  const existingManaged = (await instanceSummaries()).find(
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
  const existingAtName = await readConfig(false, requestedInstanceName);
  if (existingAtName) {
    throw new Error(
      `Instance \`${requestedInstanceName}\` already exists. Choose another ` +
        "name with `--instance <name>`.",
    );
  }

  const identity = await verifiedConnectionIdentity(selectedWorker, runner);
  const secretNames = await context.cloudflare.workerSecretNames(
    selectedWorker.accountId,
    selectedWorker.workerName,
  );
  const customDomain = selectedWorker.customDomains[0] ?? null;
  const config: MicrofeedConfig = {
    accountId: selectedWorker.accountId,
    adminAuthMode: selectedWorker.adminAuthMode,
    adminPath: selectedWorker.adminPath,
    completedSteps: [
      "d1-ready",
      "r2-ready",
      "worker-deployed",
      "deployment-verified",
      ...(secretNames.has("BETTER_AUTH_SECRET")
        ? ["better-auth-secret-created"]
        : []),
      ...(secretNames.has("UPLOAD_SIGNING_KEY")
        ? ["upload-signing-secret-created"]
        : []),
    ],
    customDomain,
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
    r2: {name: selectedWorker.r2Name, reuse: true},
    workerName: selectedWorker.workerName,
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
        "`yarn admin setup --local --instance <name>` or " +
        "`yarn admin setup --instance <name>` first.",
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
        "`yarn admin instances` to list configured instances.",
    );
  }
  await setActiveInstance(selected);
  process.stdout.write(`Active microfeed instance: ${selected}\n`);
}

export async function devCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
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
      "Production D1 and R2 data will not be accessed or changed.",
    ].join("\n"),
    "Local development",
  );
  await context.cloudflare.applyLocalMigrations(config);
  await runYarnScript(runner, "dev:astro", {
    env: {
      ...process.env,
      MICROFEED_INSTANCE: config.instanceName,
      MICROFEED_LOCAL_STATE: localPersistencePath(config),
      MICROFEED_WRANGLER_CONFIG: wranglerConfigPath(config),
    },
    interactive: true,
  });
}
