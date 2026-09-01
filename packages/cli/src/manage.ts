import {spawn, type SpawnOptions} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {constants as osConstants, homedir} from "node:os";
import path from "node:path";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {fileURLToPath} from "node:url";

import {CliError} from "./errors.js";

const MINIMUM_NODE_VERSION = [22, 12, 0] as const;
const SETUP_LOCK_STALE_MS = 60 * 60 * 1_000;
const RUNTIME_MARKER = ".microfeed-runtime.json";

type StringEnvironment = Record<string, string | undefined>;
type CommandStdio = "ignore" | "inherit" | "pipe";

export interface ManageCommandOptions {
  cwd?: string;
  env?: StringEnvironment;
  stdio?: CommandStdio;
}

export interface ManageCommandResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}

export type ManageCommandRunner = (
  executable: string,
  args: readonly string[],
  options?: ManageCommandOptions,
) => Promise<ManageCommandResult>;

export interface ManageLauncherOptions {
  cacheDirectory?: string;
  environment?: StringEnvironment;
  homeDirectory?: string;
  invocationDirectory?: string;
  output?: (value: string) => void;
  packageVersion?: string;
  platform?: NodeJS.Platform;
  runtimeDirectory?: string;
  runtimeManifestPath?: string;
  runner?: ManageCommandRunner;
  stateDirectory?: string;
  tsxJavaScript?: string;
  yarnJavaScript?: string;
}

interface ManageRuntimeFile {
  path: string;
  sha256: string;
  size: number;
}

export interface ManageRuntimeManifest {
  files: ManageRuntimeFile[];
  schemaVersion: 1;
  sourceCommit: string;
  version: string;
}

function signalExitCode(signal: NodeJS.Signals | null): number {
  if (!signal) return 1;
  const number = osConstants.signals[signal];
  return typeof number === "number" ? 128 + number : 1;
}

export const runManageProcess: ManageCommandRunner = (
  executable,
  args,
  options = {},
) => new Promise((resolve, reject) => {
  const stdio = options.stdio ?? "inherit";
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv | undefined,
    shell: false,
    stdio: stdio === "pipe" ? ["ignore", "pipe", "pipe"] : stdio,
  };
  const child = spawn(executable, [...args], spawnOptions);
  let stdout = "";
  let stderr = "";
  let settled = false;
  const forwardedSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  if (stdio === "pipe") {
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
  }

  const cleanup = (): void => {
    for (const [signal, handler] of signalHandlers) {
      process.off(signal, handler);
    }
  };
  for (const signal of forwardedSignals) {
    const handler = (): void => {
      if (!child.killed) child.kill(signal);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  child.once("error", (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  });
  child.once("close", (exitCode, signal) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve({
      exitCode: exitCode ?? signalExitCode(signal),
      signal,
      stderr,
      stdout,
    });
  });
});

export function manageCacheDirectory(
  environment: StringEnvironment = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory: string = homedir(),
): string {
  if (environment.MICROFEED_CACHE_DIR?.trim()) {
    return path.resolve(environment.MICROFEED_CACHE_DIR.trim(), "manage");
  }
  if (platform === "win32") {
    return path.join(
      environment.LOCALAPPDATA?.trim() ||
        path.join(homeDirectory, "AppData", "Local"),
      "microfeed",
      "manage",
    );
  }
  if (platform === "darwin") {
    return path.join(homeDirectory, "Library", "Caches", "microfeed", "manage");
  }
  return path.join(
    environment.XDG_CACHE_HOME?.trim() || path.join(homeDirectory, ".cache"),
    "microfeed",
    "manage",
  );
}

export function manageStateDirectory(
  environment: StringEnvironment = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory: string = homedir(),
): string {
  if (environment.MICROFEED_CONFIG_DIR?.trim()) {
    return path.join(
      path.resolve(environment.MICROFEED_CONFIG_DIR.trim()),
      "manage",
    );
  }
  const root = platform === "win32"
    ? path.join(
      environment.APPDATA?.trim() ||
        path.join(homeDirectory, "AppData", "Roaming"),
      "microfeed",
    )
    : path.join(
      environment.XDG_CONFIG_HOME?.trim() || path.join(homeDirectory, ".config"),
      "microfeed",
    );
  return path.join(root, "manage");
}

function requireSupportedNodeVersion(version = process.versions.node): void {
  const actual = version.split(".").map((part) => Number.parseInt(part, 10));
  for (const [index, minimum] of MINIMUM_NODE_VERSION.entries()) {
    const part = actual[index] ?? Number.NaN;
    if (!Number.isInteger(part) || part < minimum) {
      throw new CliError(
        "Node.js 22.12.0 or newer is required for source-code-free microfeed " +
          "deployment. Install a current Node.js LTS release from " +
          "https://nodejs.org/, then rerun the same command.",
      );
    }
    if (part > minimum) return;
  }
}

async function installedPackageVersion(): Promise<string> {
  const metadata = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {version?: unknown};
  if (typeof metadata.version !== "string" || !metadata.version.trim()) {
    throw new CliError("The installed @microfeed/cli package has no version.");
  }
  return metadata.version;
}

async function pathExists(filename: string): Promise<boolean> {
  try {
    await stat(filename);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function installedRuntimeDirectory(): string {
  return fileURLToPath(new URL("./manage-runtime-files/", import.meta.url));
}

function installedRuntimeManifestPath(): string {
  return fileURLToPath(
    new URL("./manage-runtime-manifest.json", import.meta.url),
  );
}

function installedYarnJavaScript(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("@yarnpkg/cli-dist/bin/yarn.js");
}

function installedTsxJavaScript(repositoryDirectory: string): string {
  const require = createRequire(path.join(repositoryDirectory, "package.json"));
  return require.resolve("tsx/cli");
}

function safeRuntimePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    !path.posix.isAbsolute(value) && !value.includes("\\") &&
    value.split("/").every((part) =>
      part.length > 0 && part !== "." && part !== ".."
    );
}

async function readRuntimeManifest(
  filename: string,
  expectedVersion: string,
): Promise<ManageRuntimeManifest> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filename, "utf8"));
  } catch {
    throw new CliError(
      "The installed @microfeed/cli deployment runtime is missing or " +
        "damaged. Reinstall the package and rerun the same command.",
    );
  }
  if (!value || typeof value !== "object") {
    throw new CliError("The installed deployment runtime manifest is invalid.");
  }
  const manifest = value as Partial<ManageRuntimeManifest>;
  const seen = new Set<string>();
  if (
    manifest.schemaVersion !== 1 || manifest.version !== expectedVersion ||
    typeof manifest.sourceCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(manifest.sourceCommit) ||
    !Array.isArray(manifest.files) || manifest.files.length === 0 ||
    manifest.files.some((file) => {
      if (!file || typeof file !== "object") return true;
      const entry = file as Partial<ManageRuntimeFile>;
      if (
        !safeRuntimePath(entry.path) || seen.has(entry.path) ||
        typeof entry.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(entry.sha256) ||
        typeof entry.size !== "number" ||
        !Number.isSafeInteger(entry.size) || entry.size < 0
      ) return true;
      seen.add(entry.path);
      return false;
    })
  ) {
    throw new CliError(
      "The installed @microfeed/cli deployment runtime does not match this " +
        "package version. Reinstall the package and rerun the same command.",
    );
  }
  return manifest as ManageRuntimeManifest;
}

async function sha256File(filename: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filename))
    .digest("hex");
}

function manifestsMatch(
  left: ManageRuntimeManifest,
  right: ManageRuntimeManifest,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function cachedRuntimeMatches(
  repositoryDirectory: string,
  manifest: ManageRuntimeManifest,
): Promise<boolean> {
  try {
    const cachedManifest = JSON.parse(await readFile(
      path.join(repositoryDirectory, RUNTIME_MARKER),
      "utf8",
    )) as ManageRuntimeManifest;
    if (!manifestsMatch(cachedManifest, manifest)) return false;
    for (const file of manifest.files) {
      const filename = path.join(repositoryDirectory, file.path);
      const metadata = await stat(filename);
      if (
        !metadata.isFile() || metadata.size !== file.size ||
        await sha256File(filename) !== file.sha256
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function packagedRuntimeMatches(
  runtimeDirectory: string,
  manifest: ManageRuntimeManifest,
): Promise<boolean> {
  try {
    for (const file of manifest.files) {
      const filename = path.join(runtimeDirectory, file.sha256);
      const metadata = await stat(filename);
      if (
        !metadata.isFile() || metadata.size !== file.size ||
        await sha256File(filename) !== file.sha256
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function replaceRepository(
  cacheDirectory: string,
  repositoryDirectory: string,
  runtimeDirectory: string,
  manifest: ManageRuntimeManifest,
): Promise<void> {
  const candidate = path.join(
    cacheDirectory,
    `.repository-${process.pid}-${Date.now()}`,
  );
  const previous = path.join(cacheDirectory, ".repository-previous");
  await rm(candidate, {force: true, recursive: true});
  await rm(previous, {force: true, recursive: true});
  try {
    if (!await packagedRuntimeMatches(runtimeDirectory, manifest)) {
      throw new CliError(
        "The source bundled with @microfeed/cli is damaged. Reinstall the " +
          "package and rerun the same command.",
      );
    }
    await mkdir(candidate, {recursive: true, mode: 0o700});
    for (const file of manifest.files) {
      const destination = path.join(candidate, file.path);
      await mkdir(path.dirname(destination), {recursive: true});
      await copyFile(path.join(runtimeDirectory, file.sha256), destination);
    }
    await writeFile(
      path.join(candidate, RUNTIME_MARKER),
      `${JSON.stringify(manifest, null, 2)}\n`,
      {mode: 0o600},
    );
    if (!await cachedRuntimeMatches(candidate, manifest)) {
      throw new CliError(
        "The packaged microfeed deployment runtime could not be verified. " +
          "The cached workspace was not replaced.",
      );
    }

    const hadRepository = await pathExists(repositoryDirectory);
    if (hadRepository) await rename(repositoryDirectory, previous);
    try {
      await rename(candidate, repositoryDirectory);
    } catch (error) {
      if (hadRepository && await pathExists(previous)) {
        await rename(previous, repositoryDirectory);
      }
      throw error;
    }
    await rm(previous, {force: true, recursive: true});
  } finally {
    await rm(candidate, {force: true, recursive: true});
  }
}

async function recoverInterruptedRepositorySetup(
  cacheDirectory: string,
  repositoryDirectory: string,
): Promise<void> {
  const previous = path.join(cacheDirectory, ".repository-previous");
  if (!await pathExists(repositoryDirectory) && await pathExists(previous)) {
    await rename(previous, repositoryDirectory);
  } else {
    await rm(previous, {force: true, recursive: true});
  }
  const entries = await readdir(cacheDirectory, {withFileTypes: true});
  await Promise.all(entries
    .filter(({name}) => /^\.repository-\d+-\d+$/u.test(name))
    .map(({name}) =>
      rm(path.join(cacheDirectory, name), {force: true, recursive: true})
    ));
}

async function setupLockOwnerIsActive(
  lockDirectory: string,
): Promise<boolean | undefined> {
  try {
    const owner = JSON.parse(
      await readFile(path.join(lockDirectory, "owner.json"), "utf8"),
    ) as {pid?: unknown};
    if (typeof owner.pid !== "number" ||
        !Number.isInteger(owner.pid) || owner.pid <= 0) {
      return undefined;
    }
    try {
      process.kill(owner.pid, 0);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ESRCH") return false;
      if (code === "EPERM") return true;
      return undefined;
    }
  } catch {
    return undefined;
  }
}

async function acquireSetupLock(
  lockDirectory: string,
): Promise<() => Promise<void>> {
  await mkdir(path.dirname(lockDirectory), {recursive: true});
  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const lock = await stat(lockDirectory).catch(() => undefined);
    const ownerIsActive = await setupLockOwnerIsActive(lockDirectory);
    if (
      !lock || ownerIsActive === true ||
      (ownerIsActive === undefined &&
        Date.now() - lock.mtimeMs <= SETUP_LOCK_STALE_MS)
    ) {
      throw new CliError(
        "Another microfeed management command is preparing the private " +
          "deployment workspace. Wait for it to finish, then retry.",
      );
    }
    await rm(lockDirectory, {force: true, recursive: true});
    await mkdir(lockDirectory);
  }
  await writeFile(
    path.join(lockDirectory, "owner.json"),
    `${JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()})}\n`,
    {mode: 0o600},
  );
  return async () => {
    await rm(lockDirectory, {force: true, recursive: true});
  };
}

async function prepareWorkspace(input: {
  cacheDirectory: string;
  environment: StringEnvironment;
  manifest: ManageRuntimeManifest;
  runtimeDirectory: string;
  runner: ManageCommandRunner;
  tsxJavaScript?: string;
  yarnJavaScript: string;
}): Promise<{
  environment: StringEnvironment;
  repositoryDirectory: string;
  tsxJavaScript: string;
}> {
  await mkdir(input.cacheDirectory, {recursive: true, mode: 0o700});
  if (process.platform !== "win32") {
    await chmod(input.cacheDirectory, 0o700);
  }
  const repositoryDirectory = path.join(input.cacheDirectory, "repository");
  const releaseLock = await acquireSetupLock(
    path.join(input.cacheDirectory, ".setup-lock"),
  );
  try {
    await recoverInterruptedRepositorySetup(
      input.cacheDirectory,
      repositoryDirectory,
    );
    if (!await cachedRuntimeMatches(repositoryDirectory, input.manifest)) {
      await replaceRepository(
        input.cacheDirectory,
        repositoryDirectory,
        input.runtimeDirectory,
        input.manifest,
      );
    }

    const environment: StringEnvironment = {
      ...input.environment,
      MICROFEED_YARN_JAVASCRIPT: input.yarnJavaScript,
    };
    const install = await input.runner(
      process.execPath,
      [input.yarnJavaScript, "install", "--immutable"],
      {cwd: repositoryDirectory, env: environment, stdio: "inherit"},
    );
    if (install.exitCode !== 0) {
      throw new CliError(
        "The exact microfeed release was unpacked, but its locked " +
          "dependencies could not be installed. Fix the reported Yarn error " +
          "and rerun the same command.",
        install.exitCode,
      );
    }
    return {
      environment,
      repositoryDirectory,
      tsxJavaScript: input.tsxJavaScript ??
        installedTsxJavaScript(repositoryDirectory),
    };
  } finally {
    await releaseLock();
  }
}

export function manageAgentHandoff(
  repositoryDirectory: string,
  version: string,
): string {
  const skill = path.join(
    repositoryDirectory,
    ".agents",
    "skills",
    "deploy-microfeed",
    "SKILL.md",
  );
  const reference = path.join(repositoryDirectory, "docs", "manage-cli.md");
  return [
    `microfeed v${version} deployment workspace is ready.`,
    "",
    "Coding agent instructions:",
    `1. Read \`${skill}\` completely.`,
    `2. Read \`${reference}\` completely.`,
    "3. Follow that deployment workflow until `status` verifies the site.",
    "4. Wherever those files print `yarn manage …`, run " +
      "`npx @microfeed/cli manage …` from this conversation instead.",
    "5. Wherever they print `yarn dev …`, run " +
      "`npx @microfeed/cli manage dev …` instead.",
    "",
    "Start with:",
    "  npx @microfeed/cli manage accounts --json",
    "",
    "Do not stop after preparing this workspace. Discover whether the site is " +
      "new or existing, ask before ambiguous or consequential choices, and " +
      "continue until the final status check succeeds.",
    "",
  ].join("\n");
}

export async function runManageLauncher(
  args: readonly string[],
  options: ManageLauncherOptions = {},
): Promise<number> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? homedir();
  const runner = options.runner ?? runManageProcess;
  const packageVersion = options.packageVersion ?? await installedPackageVersion();
  const cacheDirectory = options.cacheDirectory ?? manageCacheDirectory(
    environment,
    platform,
    homeDirectory,
  );
  const stateDirectory = options.stateDirectory ?? manageStateDirectory(
    environment,
    platform,
    homeDirectory,
  );
  const invocationDirectory = options.invocationDirectory ?? process.cwd();
  const runtimeDirectory = options.runtimeDirectory ??
    installedRuntimeDirectory();
  const runtimeManifestPath = options.runtimeManifestPath ??
    installedRuntimeManifestPath();
  const yarnJavaScript = options.yarnJavaScript ?? installedYarnJavaScript();

  requireSupportedNodeVersion();
  const manifest = await readRuntimeManifest(
    runtimeManifestPath,
    packageVersion,
  );

  const workspace = await prepareWorkspace({
    cacheDirectory,
    environment,
    manifest,
    runtimeDirectory,
    runner,
    tsxJavaScript: options.tsxJavaScript,
    yarnJavaScript,
  });
  if (args.length === 0) {
    (options.output ?? ((value) => process.stdout.write(value)))(
      manageAgentHandoff(workspace.repositoryDirectory, packageVersion),
    );
    return 0;
  }

  await mkdir(stateDirectory, {recursive: true, mode: 0o700});
  if (process.platform !== "win32") {
    await chmod(stateDirectory, 0o700);
  }
  // Execute the JavaScript entry directly so Windows never needs a .cmd shim.
  const result = await runner(
    process.execPath,
    [
      workspace.tsxJavaScript,
      "--tsconfig",
      path.join(workspace.repositoryDirectory, "tsconfig.json"),
      path.join(workspace.repositoryDirectory, "manage-cli", "index.ts"),
      ...args,
    ],
    {
      cwd: invocationDirectory,
      env: {
        ...workspace.environment,
        MICROFEED_STATE_DIRECTORY: stateDirectory,
      },
      stdio: "inherit",
    },
  );
  return result.exitCode;
}
