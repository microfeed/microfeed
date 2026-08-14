import {randomBytes, randomUUID} from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {isDeepStrictEqual} from "node:util";

import {
  type AdminAuthMode,
  normalizeAdminAuthMode,
} from "@/shared/AdminAuth";
import {normalizeAdminPath} from "@/shared/AdminPath";
import type {
  InstanceHosting,
  MicrofeedConfig,
  R2SetupMode,
} from "../types";
import {repositoryRoot} from "./process";

export const stateDirectory = process.env.MICROFEED_STATE_DIRECTORY
  ? path.resolve(process.env.MICROFEED_STATE_DIRECTORY)
  : path.join(repositoryRoot, ".microfeed");
export const instancesDirectory = path.join(stateDirectory, "instances");
export const activeInstancePath = path.join(stateDirectory, "active-instance");
export const legacyConfigPath = path.join(stateDirectory, "config.json");
export const legacyPreviewConfigPath = path.join(
  stateDirectory,
  "preview.json",
);
const templatePath = path.join(repositoryRoot, "wrangler.template.jsonc");
export const builtWranglerConfigPath = path.join(
  repositoryRoot,
  "dist",
  "server",
  "wrangler.json",
);
const LOCAL_INSTANCE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export interface InstanceSummary {
  active: boolean;
  config: MicrofeedConfig;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateLocalInstanceName(value: string): string | undefined {
  if (!LOCAL_INSTANCE_PATTERN.test(value)) {
    return "Use lowercase letters, numbers, and hyphens (1–63 characters).";
  }
  return undefined;
}

export function normalizeLocalInstanceName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, 63)
    .replaceAll(/-+$/gu, "");
  return validateLocalInstanceName(normalized) ? "microfeed" : normalized;
}

export function instanceDirectory(instanceName: string): string {
  const error = validateLocalInstanceName(instanceName);
  if (error) {
    throw new Error(`Invalid instance name \`${instanceName}\`. ${error}`);
  }
  return path.join(instancesDirectory, instanceName);
}

export function configFilePath(
  instanceName: string,
  preview = false,
): string {
  return path.join(
    instanceDirectory(instanceName),
    ...(preview ? ["preview", "config.json"] : ["config.json"]),
  );
}

export function wranglerConfigPath(
  config: MicrofeedConfig,
): string {
  return path.join(
    instanceDirectory(config.instanceName),
    ...(deploymentEnvironment(config) === "preview"
      ? ["preview", "wrangler.jsonc"]
      : ["wrangler.jsonc"]),
  );
}

export function localPersistencePath(config: MicrofeedConfig): string {
  return path.join(instanceDirectory(config.instanceName), "local-state");
}

export function localDevVarsPath(config: MicrofeedConfig): string {
  const base = deploymentEnvironment(config) === "preview"
    ? path.join(instanceDirectory(config.instanceName), "preview")
    : instanceDirectory(config.instanceName);
  return path.join(base, ".dev.vars");
}

function normalizedHosting(value: Record<string, unknown>): InstanceHosting {
  if (value.hosting === "local" || value.hosting === "cloudflare") {
    return value.hosting;
  }
  return value.accountId === "local" ? "local" : "cloudflare";
}

function normalizedR2SetupMode(
  value: Record<string, unknown>,
): R2SetupMode {
  return value.setupMode === "disabled" ? "disabled" : "automatic";
}

function validateConfig(
  value: unknown,
  source = ".microfeed configuration",
  selectedInstanceName?: string,
): MicrofeedConfig {
  if (!isRecord(value) || !isRecord(value.d1) || !isRecord(value.r2)) {
    throw new Error(
      `Invalid ${source}. Run \`yarn manage init\` to repair it.`,
    );
  }
  const hosting = normalizedHosting(value);
  const rawInstanceName = selectedInstanceName ??
    value.instanceName ??
    value.localInstance;
  const accountId = hosting === "local" ? null : value.accountId;
  const nullableStrings = [value.customDomain, value.deploymentUrl];
  const validAccount = hosting === "local"
    ? value.accountId === null || value.accountId === "local"
    : typeof accountId === "string" &&
      accountId.length > 0 &&
      accountId !== "local";
  const normalizedCompletedSteps = (
    Array.isArray(value.completedSteps) ? value.completedSteps : []
  ).filter(
    (step): step is string => typeof step === "string",
  );
  if (
    hosting === "local" &&
    value.r2.setupMode === undefined &&
    !normalizedCompletedSteps.includes("r2-ready")
  ) {
    normalizedCompletedSteps.push("r2-ready");
  }
  const valid = [
    value.instanceId,
    value.projectName,
    value.d1.name,
    value.r2.name,
    rawInstanceName,
  ].every((entry) => typeof entry === "string" && entry.length > 0) &&
    typeof rawInstanceName === "string" &&
    !validateLocalInstanceName(rawInstanceName) &&
    validAccount &&
    typeof value.d1.id === "string" &&
    nullableStrings.every(
      (entry) => entry === null || typeof entry === "string",
    ) &&
    typeof value.d1.reuse === "boolean" &&
    typeof value.r2.reuse === "boolean" &&
    Array.isArray(value.completedSteps) &&
    value.completedSteps.every((step) => typeof step === "string") &&
    (
      !value.completedSteps.includes("d1-ready") ||
      value.d1.id.length > 0
    ) &&
    (
      value.adminAuthMode === undefined ||
      value.adminAuthMode === "built-in" ||
      value.adminAuthMode === "none"
    ) &&
    (
      value.pagesProjectName === undefined ||
      typeof value.pagesProjectName === "string"
    ) &&
    (
      value.workerName === undefined ||
      (
        typeof value.workerName === "string" &&
        value.workerName.length > 0
      )
    ) &&
    (
      value.restoreBaseline === undefined ||
      (
        isRecord(value.restoreBaseline) &&
        typeof value.restoreBaseline.createdAt === "string" &&
        value.restoreBaseline.createdAt.length > 0 &&
        typeof value.restoreBaseline.fingerprint === "string" &&
        /^[a-f0-9]{64}$/u.test(value.restoreBaseline.fingerprint)
      )
    ) &&
    (
      value.deploymentEnvironment === undefined ||
      value.deploymentEnvironment === "production" ||
      value.deploymentEnvironment === "preview"
    ) &&
    (
      value.webhooks === undefined ||
      (
        isRecord(value.webhooks) &&
        typeof value.webhooks.enabled === "boolean" &&
        typeof value.webhooks.queueName === "string" &&
        value.webhooks.queueName.length > 0 &&
        typeof value.webhooks.reuse === "boolean"
      )
    ) &&
    (value.hosting === undefined ||
      value.hosting === "cloudflare" ||
      value.hosting === "local");
  if (!valid) {
    throw new Error(
      `Invalid ${source}. Run \`yarn manage init\` to repair it.`,
    );
  }
  return {
    accountId: accountId as string | null,
    adminAuthMode: value.adminAuthMode as AdminAuthMode | undefined,
    adminPath: normalizeAdminPath(
      typeof value.adminPath === "string" ? value.adminPath : undefined,
    ),
    completedSteps: normalizedCompletedSteps,
    customDomain: value.customDomain as string | null,
    ...(value.deploymentEnvironment
      ? {
          deploymentEnvironment: value.deploymentEnvironment as
            | "preview"
            | "production",
        }
      : {}),
    d1: {
      id: value.d1.id as string,
      name: value.d1.name as string,
      reuse: value.d1.reuse as boolean,
    },
    deploymentUrl: value.deploymentUrl as string | null,
    hosting,
    instanceId: value.instanceId as string,
    instanceName: rawInstanceName,
    ...(typeof value.pagesProjectName === "string"
      ? {pagesProjectName: value.pagesProjectName}
      : {}),
    projectName: value.projectName as string,
    r2: {
      name: value.r2.name as string,
      reuse: value.r2.reuse as boolean,
      setupMode: normalizedR2SetupMode(value.r2),
    },
    ...(isRecord(value.restoreBaseline)
      ? {
          restoreBaseline: {
            createdAt: value.restoreBaseline.createdAt as string,
            fingerprint: value.restoreBaseline.fingerprint as string,
          },
        }
      : {}),
    ...(typeof value.workerName === "string"
      ? {workerName: value.workerName}
      : {}),
    ...(isRecord(value.webhooks)
      ? {
          webhooks: {
            enabled: value.webhooks.enabled as boolean,
            queueName: value.webhooks.queueName as string,
            reuse: value.webhooks.reuse as boolean,
          },
        }
      : {}),
  };
}

async function readOptionalFile(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(
  filename: string,
  value: MicrofeedConfig,
): Promise<void> {
  await mkdir(path.dirname(filename), {recursive: true});
  const temporaryPath = `${filename}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    {encoding: "utf8", mode: 0o600},
  );
  await rename(temporaryPath, filename);
}

async function migrateLegacyConfig(): Promise<void> {
  const existingInstances = await listLocalInstances(false);
  if (existingInstances.length > 0) {
    return;
  }
  const legacyContents = await readOptionalFile(legacyConfigPath);
  if (!legacyContents) {
    return;
  }
  const legacyValue = JSON.parse(legacyContents) as unknown;
  if (!isRecord(legacyValue)) {
    throw new Error(
      "Invalid .microfeed/config.json. Run `yarn manage init` to repair it.",
    );
  }
  const legacyInstanceName = normalizeLocalInstanceName(
    typeof legacyValue.workerName === "string"
      ? legacyValue.workerName
      : typeof legacyValue.projectName === "string"
        ? legacyValue.projectName
        : "microfeed",
  );
  const legacyConfig = validateConfig(
    legacyValue,
    ".microfeed/config.json",
    legacyInstanceName,
  );
  const instanceName = legacyInstanceName;
  legacyConfig.instanceName = instanceName;
  await writeJsonFile(configFilePath(instanceName), legacyConfig);

  const legacyPreviewContents = await readOptionalFile(legacyPreviewConfigPath);
  if (legacyPreviewContents) {
    const previewConfig = validateConfig(
      JSON.parse(legacyPreviewContents),
      ".microfeed/preview.json",
      instanceName,
    );
    previewConfig.instanceName = instanceName;
    await writeJsonFile(configFilePath(instanceName, true), previewConfig);
  }
  await setActiveInstance(instanceName);
}

export async function listLocalInstances(
  migrateLegacy = true,
): Promise<string[]> {
  if (migrateLegacy) {
    await migrateLegacyConfig();
  }
  try {
    const entries = await readdir(instancesDirectory, {withFileTypes: true});
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !validateLocalInstanceName(entry.name),
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

export async function readActiveInstance(): Promise<string | null> {
  await migrateLegacyConfig();
  const value = (await readOptionalFile(activeInstancePath))?.trim();
  if (!value || validateLocalInstanceName(value)) {
    return null;
  }
  return (await listLocalInstances(false)).includes(value) ? value : null;
}

export async function setActiveInstance(instanceName: string): Promise<void> {
  instanceDirectory(instanceName);
  await mkdir(stateDirectory, {recursive: true});
  const temporaryPath = `${activeInstancePath}.tmp`;
  await writeFile(temporaryPath, `${instanceName}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, activeInstancePath);
}

export async function defaultLocalInstance(
  requested?: string,
): Promise<string | null> {
  await migrateLegacyConfig();
  const explicit = requested ?? process.env.MICROFEED_INSTANCE;
  if (explicit) {
    const error = validateLocalInstanceName(explicit);
    if (error) {
      throw new Error(`Invalid instance name \`${explicit}\`. ${error}`);
    }
    return explicit;
  }
  const active = await readActiveInstance();
  if (active) {
    return active;
  }
  const instances = await listLocalInstances(false);
  return instances.length === 1 ? instances[0]! : null;
}

export async function readConfig(
  preview = false,
  instanceName?: string,
): Promise<MicrofeedConfig | null> {
  const selectedInstance = await defaultLocalInstance(instanceName);
  if (!selectedInstance) {
    return null;
  }
  const targetPath = configFilePath(selectedInstance, preview);
  try {
    const rawConfig = JSON.parse(await readFile(targetPath, "utf8")) as unknown;
    const config = validateConfig(
      rawConfig,
      path.relative(repositoryRoot, targetPath),
      selectedInstance,
    );
    if (
      (preview && config.deploymentEnvironment !== "preview") ||
      (!preview && config.deploymentEnvironment === "preview")
    ) {
      throw new Error(
        `Invalid ${path.basename(targetPath)} deployment environment.`,
      );
    }
    if (
      isRecord(rawConfig) &&
      (
        rawConfig.hosting !== config.hosting ||
        rawConfig.instanceName !== selectedInstance ||
        "localInstance" in rawConfig ||
        rawConfig.accountId !== config.accountId ||
        (
          isRecord(rawConfig.r2) &&
          rawConfig.r2.setupMode !== config.r2.setupMode
        ) ||
        !isDeepStrictEqual(rawConfig.completedSteps, config.completedSteps)
      )
    ) {
      await writeJsonFile(targetPath, config);
    }
    return config;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeConfig(config: MicrofeedConfig): Promise<void> {
  await writeJsonFile(
    configFilePath(
      config.instanceName,
      deploymentEnvironment(config) === "preview",
    ),
    config,
  );
}

async function unlinkIfPresent(filename: string): Promise<void> {
  try {
    await unlink(filename);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

export async function removeSavedInstance(
  instanceName: string,
  preview = false,
): Promise<void> {
  const targetDirectory = preview
    ? path.join(instanceDirectory(instanceName), "preview")
    : instanceDirectory(instanceName);
  const wasActive = !preview && await readActiveInstance() === instanceName;
  await rm(targetDirectory, {force: true, recursive: true});
  if (!wasActive) {
    return;
  }
  const remaining = await listLocalInstances(false);
  if (remaining.length > 0) {
    await setActiveInstance(remaining[0]!);
    return;
  }
  await unlinkIfPresent(activeInstancePath);
}

export function deploymentEnvironment(
  config: MicrofeedConfig,
): "preview" | "production" {
  return config.deploymentEnvironment ?? "production";
}

export function adminAuthMode(
  config: MicrofeedConfig,
): AdminAuthMode {
  return normalizeAdminAuthMode(config.adminAuthMode);
}

export function requiredSecrets(config: MicrofeedConfig): string[] {
  return [
    "UPLOAD_SIGNING_KEY",
    ...(adminAuthMode(config) === "built-in"
      ? ["BETTER_AUTH_SECRET"]
      : []),
    ...(config.webhooks?.enabled ? ["WEBHOOK_SECRET_KEY"] : []),
  ];
}

export function workerName(config: MicrofeedConfig): string {
  return config.workerName ?? config.projectName;
}

export function workersDevEnabled(config: MicrofeedConfig): boolean {
  return config.customDomain === null;
}

export function workersCacheEnabled(config: MicrofeedConfig): boolean {
  return config.hosting === "cloudflare" &&
    deploymentEnvironment(config) === "production";
}

export function localConfig(instanceName = "local"): MicrofeedConfig {
  const resourcePrefix = instanceName === "local"
    ? "microfeed-local"
    : `microfeed-${instanceName}`;
  return {
    accountId: null,
    adminAuthMode: "built-in",
    adminPath: "admin",
    completedSteps: ["r2-ready"],
    customDomain: null,
    d1: {
      id: "00000000-0000-0000-0000-000000000000",
      name: `${resourcePrefix}-db`,
      reuse: false,
    },
    deploymentUrl: "http://localhost:4321",
    hosting: "local",
    instanceId: randomUUID(),
    instanceName,
    projectName: resourcePrefix,
    r2: {
      name: `${resourcePrefix}-media`,
      reuse: false,
      setupMode: "automatic",
    },
    webhooks: {
      enabled: false,
      queueName: `${resourcePrefix}-webhooks`,
      reuse: false,
    },
  };
}

export function isLocalOnly(config: MicrofeedConfig): boolean {
  return config.hosting === "local";
}

export function isR2Ready(config: MicrofeedConfig): boolean {
  return config.completedSteps.includes("r2-ready");
}

export function cloudflareAccountId(config: MicrofeedConfig): string {
  if (config.hosting !== "cloudflare" || !config.accountId) {
    throw new Error(
      `Instance \`${config.instanceName}\` is local only and has no ` +
        "Cloudflare account.",
    );
  }
  return config.accountId;
}

export async function ensureLocalOnlyConfig(
  instanceName: string,
): Promise<MicrofeedConfig> {
  const existing = await readConfig(false, instanceName);
  if (existing) {
    if (!isLocalOnly(existing)) {
      throw new Error(
        `Instance \`${instanceName}\` already manages Cloudflare Worker ` +
          `\`${workerName(existing)}\`. Choose a different local instance ` +
          "name.",
      );
    }
    await generateWranglerConfig(existing);
    await ensureLocalDevVars(existing);
    return existing;
  }
  const config = localConfig(instanceName);
  await writeConfig(config);
  await setActiveInstance(instanceName);
  await generateWranglerConfig(config);
  await ensureLocalDevVars(config);
  return config;
}

async function ensureLocalDevVars(config: MicrofeedConfig): Promise<void> {
  const devVarsPath = localDevVarsPath(config);
  let currentDevVars = "";
  try {
    currentDevVars = await readFile(devVarsPath, "utf8");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
  const additions = [
    currentDevVars.includes("UPLOAD_SIGNING_KEY=")
      ? ""
      : `UPLOAD_SIGNING_KEY=${randomBytes(32).toString("base64url")}`,
    currentDevVars.includes("BETTER_AUTH_SECRET=")
      ? ""
      : `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`,
    currentDevVars.includes("WEBHOOK_SECRET_KEY=")
      ? ""
      : `WEBHOOK_SECRET_KEY=${randomBytes(32).toString("base64url")}`,
  ].filter(Boolean);
  if (additions.length > 0) {
    const prefix = currentDevVars && !currentDevVars.endsWith("\n")
      ? "\n"
      : "";
    await writeFile(
      devVarsPath,
      `${currentDevVars}${prefix}${additions.join("\n")}\n`,
      {encoding: "utf8", mode: 0o600},
    );
  }
}

export async function generateWranglerConfig(
  config: MicrofeedConfig,
): Promise<void> {
  const template = await readFile(templatePath, "utf8");
  const targetPath = wranglerConfigPath(config);
  const relativeRoot = path
    .relative(path.dirname(targetPath), repositoryRoot)
    .replaceAll(path.sep, "/") || ".";
  const effectiveAdminAuthMode = adminAuthMode(config);
  const secrets = requiredSecrets(config);
  const routes = config.customDomain
    ? JSON.stringify([
        {custom_domain: true, pattern: config.customDomain},
      ], null, 2)
    : "[]";
  const r2Binding = config.completedSteps.includes("r2-ready")
    ? `"r2_buckets": ${JSON.stringify([
        {binding: "MEDIA_BUCKET", bucket_name: config.r2.name},
      ], null, 2)},`
    : "";
  const webhookBindings = config.webhooks?.enabled
    ? `"queues": ${JSON.stringify({
        consumers: [{
          max_batch_size: 1,
          max_batch_timeout: 1,
          max_retries: 5,
          queue: config.webhooks.queueName,
        }],
        producers: [{
          binding: "WEBHOOK_QUEUE",
          queue: config.webhooks.queueName,
        }],
      }, null, 2)},\n  "triggers": {"crons": ["*/5 * * * *"]},`
    : "";
  const rendered = template
    .replaceAll("__PROJECT_ROOT__", relativeRoot)
    .replaceAll("__WORKER_NAME__", workerName(config))
    .replaceAll("__WORKERS_DEV__", String(workersDevEnabled(config)))
    .replaceAll(
      "__WORKERS_CACHE_ENABLED__",
      String(workersCacheEnabled(config)),
    )
    .replaceAll("__CLOUDFLARE_ACCOUNT_ID__", config.accountId ?? "")
    .replaceAll("__PROJECT_NAME__", config.projectName)
    .replaceAll("__ADMIN_AUTH_MODE__", effectiveAdminAuthMode)
    .replaceAll("__ADMIN_PATH__", config.adminPath)
    .replaceAll("__D1_DATABASE_NAME__", config.d1.name)
    .replaceAll("__D1_DATABASE_ID__", config.d1.id)
    .replaceAll("__R2_BUCKET_NAME__", config.r2.name)
    .replaceAll("__R2_SETUP_MODE__", config.r2.setupMode)
    .replaceAll(
      "__DEPLOYMENT_ENVIRONMENT__",
      deploymentEnvironment(config),
    )
    .replaceAll("__INSTANCE_ID__", config.instanceId)
    .replaceAll("__INSTANCE_NAME__", config.instanceName)
    .replace("__REQUIRED_SECRETS__", JSON.stringify(secrets))
    .replace("__R2_BINDING__", r2Binding)
    .replace("__WEBHOOK_BINDINGS__", webhookBindings)
    .replace("__ROUTES__", routes);
  await mkdir(path.dirname(targetPath), {recursive: true});
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, rendered, "utf8");
  await rename(temporaryPath, targetPath);
}

export async function ensureWranglerConfig(
  allowLocal: boolean,
  preview = false,
  instanceName?: string,
): Promise<MicrofeedConfig> {
  const selectedInstance = await defaultLocalInstance(instanceName);
  const config = await readConfig(preview, selectedInstance ?? undefined);
  if (!config && !allowLocal) {
    const suffix = selectedInstance
      ? ` for instance \`${selectedInstance}\``
      : "";
    const instanceOption = selectedInstance
      ? ` --instance ${selectedInstance}`
      : "";
    throw new Error(
      preview
        ? `No preview environment was found${suffix}. Run ` +
          "`yarn manage init --preview` first."
        : `No saved local microfeed configuration was found${suffix}. ` +
          "To connect an existing Cloudflare microfeed under this local " +
          `name, run \`yarn manage connect${instanceOption}\`. To create a ` +
          "new Cloudflare installation, run " +
          `\`yarn manage init${instanceOption}\`.`,
    );
  }
  if (config && !allowLocal && isLocalOnly(config)) {
    throw new Error(
      `Instance \`${config.instanceName}\` is local only and has no ` +
        "Cloudflare deployment. Run " +
        `\`yarn dev --instance ${config.instanceName}\`, or select a ` +
        "Cloudflare instance with `yarn manage use <name>`.",
    );
  }
  const effectiveConfig = config ??
    await ensureLocalOnlyConfig(selectedInstance ?? "local");
  await generateWranglerConfig(effectiveConfig);
  if (allowLocal) {
    await ensureLocalDevVars(effectiveConfig);
  }
  return effectiveConfig;
}

export async function instanceSummaries(): Promise<InstanceSummary[]> {
  const [instances, active] = await Promise.all([
    listLocalInstances(),
    readActiveInstance(),
  ]);
  const summaries = await Promise.all(
    instances.map(async (name): Promise<InstanceSummary | null> => {
      const config = await readConfig(false, name);
      return config ? {active: name === active, config, name} : null;
    }),
  );
  return summaries.filter(
    (summary): summary is InstanceSummary => summary !== null,
  );
}

export function markStep(
  config: MicrofeedConfig,
  step: string,
): MicrofeedConfig {
  if (!config.completedSteps.includes(step)) {
    config.completedSteps.push(step);
  }
  return config;
}
