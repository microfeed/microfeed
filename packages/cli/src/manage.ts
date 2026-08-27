import {spawn, type SpawnOptions} from "node:child_process";
import {constants as osConstants, homedir} from "node:os";
import path from "node:path";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";

import {CliError} from "./errors.js";

const MICROFEED_REPOSITORY_URL =
  "https://github.com/microfeed/microfeed.git";
const MINIMUM_NODE_VERSION = [22, 12, 0] as const;
const SETUP_LOCK_STALE_MS = 60 * 60 * 1_000;

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
  runner?: ManageCommandRunner;
  stateDirectory?: string;
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
        "Node.js 22.12.0 or newer is required for clone-free microfeed " +
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

async function requireExecutable(
  runner: ManageCommandRunner,
  executable: string,
  remediation: string,
): Promise<void> {
  try {
    const result = await runner(executable, ["--version"], {stdio: "pipe"});
    if (result.exitCode === 0) return;
  } catch {
    // The actionable error below is the same for a missing or unusable tool.
  }
  throw new CliError(remediation);
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

async function repositoryMatchesVersion(
  repositoryDirectory: string,
  version: string,
  runner: ManageCommandRunner,
): Promise<boolean> {
  try {
    const metadata = JSON.parse(
      await readFile(path.join(repositoryDirectory, "package.json"), "utf8"),
    ) as {version?: unknown};
    if (metadata.version !== version) return false;
    const [head, release, status] = await Promise.all([
      runner(
        "git",
        ["-C", repositoryDirectory, "rev-parse", "--verify", "HEAD"],
        {stdio: "pipe"},
      ),
      runner(
        "git",
        [
          "-C",
          repositoryDirectory,
          "rev-parse",
          `refs/tags/v${version}^{commit}`,
        ],
        {stdio: "pipe"},
      ),
      runner(
        "git",
        [
          "-C",
          repositoryDirectory,
          "status",
          "--porcelain",
          "--untracked-files=all",
        ],
        {stdio: "pipe"},
      ),
    ]);
    return head.exitCode === 0 && release.exitCode === 0 &&
      status.exitCode === 0 && status.stdout.trim() === "" &&
      head.stdout.trim() === release.stdout.trim() && Boolean(head.stdout.trim());
  } catch {
    return false;
  }
}

async function replaceRepository(
  cacheDirectory: string,
  repositoryDirectory: string,
  version: string,
  runner: ManageCommandRunner,
): Promise<void> {
  const candidate = path.join(
    cacheDirectory,
    `.repository-${process.pid}-${Date.now()}`,
  );
  const previous = path.join(cacheDirectory, ".repository-previous");
  await rm(candidate, {force: true, recursive: true});
  await rm(previous, {force: true, recursive: true});
  try {
    const clone = await runner(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        `v${version}`,
        MICROFEED_REPOSITORY_URL,
        candidate,
      ],
      {stdio: "inherit"},
    );
    if (clone.exitCode !== 0) {
      throw new CliError(
        `Could not download microfeed release v${version}. Confirm that the ` +
          "release tag exists and that GitHub is reachable, then rerun the command.",
        clone.exitCode,
      );
    }
    if (!await repositoryMatchesVersion(candidate, version, runner)) {
      throw new CliError(
        `The downloaded source did not match @microfeed/cli ${version}. ` +
          "The deployment workspace was not replaced.",
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
  packageVersion: string;
  platform: NodeJS.Platform;
  runner: ManageCommandRunner;
}): Promise<{
  environment: StringEnvironment;
  repositoryDirectory: string;
  tsxExecutable: string;
}> {
  await mkdir(input.cacheDirectory, {recursive: true, mode: 0o700});
  if (process.platform !== "win32") {
    await chmod(input.cacheDirectory, 0o700);
  }
  const repositoryDirectory = path.join(input.cacheDirectory, "repository");
  const binDirectory = path.join(input.cacheDirectory, "bin");
  const releaseLock = await acquireSetupLock(
    path.join(input.cacheDirectory, ".setup-lock"),
  );
  try {
    await recoverInterruptedRepositorySetup(
      input.cacheDirectory,
      repositoryDirectory,
    );
    if (!await repositoryMatchesVersion(
      repositoryDirectory,
      input.packageVersion,
      input.runner,
    )) {
      await replaceRepository(
        input.cacheDirectory,
        repositoryDirectory,
        input.packageVersion,
        input.runner,
      );
    }

    await mkdir(binDirectory, {recursive: true});
    const environment: StringEnvironment = {
      ...input.environment,
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      COREPACK_HOME: path.join(input.cacheDirectory, "corepack"),
      PATH: [binDirectory, input.environment.PATH].filter(Boolean)
        .join(path.delimiter),
    };
    const corepack = input.platform === "win32" ? "corepack.cmd" : "corepack";
    const enable = await input.runner(
      corepack,
      ["enable", "--install-directory", binDirectory, "yarn"],
      {env: environment, stdio: "pipe"},
    );
    if (enable.exitCode !== 0) {
      throw new CliError(
        "Corepack could not create the private Yarn launcher. " +
          (enable.stderr.trim() || enable.stdout.trim() ||
            "Rerun after repairing Corepack."),
        enable.exitCode,
      );
    }
    const yarn = path.join(
      binDirectory,
      input.platform === "win32" ? "yarn.cmd" : "yarn",
    );
    const install = await input.runner(
      yarn,
      ["install", "--immutable"],
      {cwd: repositoryDirectory, env: environment, stdio: "inherit"},
    );
    if (install.exitCode !== 0) {
      throw new CliError(
        "The exact microfeed release was downloaded, but its locked " +
          "dependencies could not be installed. Fix the reported Yarn error " +
          "and rerun the same command.",
        install.exitCode,
      );
    }
    return {
      environment,
      repositoryDirectory,
      tsxExecutable: path.join(
        repositoryDirectory,
        "node_modules",
        ".bin",
        input.platform === "win32" ? "tsx.cmd" : "tsx",
      ),
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

  requireSupportedNodeVersion();
  await requireExecutable(
    runner,
    platform === "win32" ? "npm.cmd" : "npm",
    "npm is required for clone-free microfeed deployment. Install a current " +
      "Node.js LTS release, including npm, from https://nodejs.org/, then " +
      "rerun the same command.",
  );
  await requireExecutable(
    runner,
    "git",
    "Git is required for clone-free microfeed deployment. Install Git from " +
      "https://git-scm.com/downloads, then rerun the same command.",
  );
  await requireExecutable(
    runner,
    platform === "win32" ? "corepack.cmd" : "corepack",
    "Corepack is required for clone-free microfeed deployment. Install it " +
      "with `npm install --global corepack`, then rerun the same command.",
  );

  const workspace = await prepareWorkspace({
    cacheDirectory,
    environment,
    packageVersion,
    platform,
    runner,
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
  const result = await runner(
    workspace.tsxExecutable,
    [
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
