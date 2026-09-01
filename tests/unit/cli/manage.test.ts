import {createHash} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it} from "vitest";

import {
  manageAgentHandoff,
  manageCacheDirectory,
  type ManageCommandOptions,
  type ManageCommandResult,
  type ManageCommandRunner,
  type ManageRuntimeManifest,
  manageStateDirectory,
  requireSupportedManageArchitecture,
  runManageLauncher,
  runManageProcess,
} from "../../../packages/cli/src/manage";

const temporaryDirectories: string[] = [];
const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), name));
  temporaryDirectories.push(directory);
  return directory;
}

function commandResult(
  input: Partial<ManageCommandResult> = {},
): ManageCommandResult {
  return {
    exitCode: 0,
    signal: null,
    stderr: "",
    stdout: "",
    ...input,
  };
}

interface RecordedCommand {
  args: readonly string[];
  executable: string;
  options: ManageCommandOptions;
}

interface RuntimeFixture {
  runtimeDirectory: string;
  runtimeManifestPath: string;
  tsxJavaScript: string;
  yarnJavaScript: string;
}

async function runtimeFixture(
  root: string,
  version = "1.2.3",
): Promise<RuntimeFixture> {
  const runtimeDirectory = path.join(root, "packaged-runtime");
  const runtimeManifestPath = path.join(root, "runtime-manifest.json");
  const tsxJavaScript = path.join(root, "tsx.mjs");
  const yarnJavaScript = path.join(root, "yarn.js");
  const files = new Map<string, string>([
    [".agents/skills/deploy-microfeed/SKILL.md", "# Deploy microfeed\n"],
    ["docs/manage-cli.md", "# Management CLI\n"],
    ["manage-cli/index.ts", "// management entry point\n"],
    ["package.json", `${JSON.stringify({name: "microfeed", version})}\n`],
    ["tsconfig.json", "{}\n"],
  ]);
  const manifestFiles: ManageRuntimeManifest["files"] = [];
  for (const [relativePath, contents] of files) {
    const digest = createHash("sha256").update(contents).digest("hex");
    await mkdir(runtimeDirectory, {recursive: true});
    await writeFile(path.join(runtimeDirectory, digest), contents);
    manifestFiles.push({
      path: relativePath,
      sha256: digest,
      size: Buffer.byteLength(contents),
    });
  }
  const manifest: ManageRuntimeManifest = {
    files: manifestFiles,
    schemaVersion: 1,
    sourceCommit: SOURCE_COMMIT,
    version,
  };
  await writeFile(
    runtimeManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(tsxJavaScript, "// pinned tsx CLI\n");
  await writeFile(yarnJavaScript, "// pinned Yarn CLI\n");
  return {
    runtimeDirectory,
    runtimeManifestPath,
    tsxJavaScript,
    yarnJavaScript,
  };
}

function workspaceRunner(
  commands: RecordedCommand[],
  finalResult: ManageCommandResult = commandResult(),
): ManageCommandRunner {
  return async (executable, args, options = {}) => {
    commands.push({args: [...args], executable, options});
    if (args.some((argument) =>
      argument.endsWith(path.join("manage-cli", "index.ts"))
    )) return finalResult;
    return commandResult();
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("source-code-free management launcher", () => {
  it("requires x64 Node.js for Windows management", () => {
    expect(() => requireSupportedManageArchitecture("win32", "arm64"))
      .toThrow(/requires the x64 build of Node\.js/u);
    expect(() => requireSupportedManageArchitecture("win32", "x64"))
      .not.toThrow();
    expect(() => requireSupportedManageArchitecture("darwin", "arm64"))
      .not.toThrow();
  });

  it("rejects unsupported Windows Node.js before preparing a workspace", async () => {
    const root = await temporaryDirectory("microfeed-manage-architecture-");
    const cacheDirectory = path.join(root, "cache");
    const commands: RecordedCommand[] = [];

    await expect(runManageLauncher([], {
      architecture: "arm64",
      cacheDirectory,
      packageVersion: "1.2.3",
      platform: "win32",
      runner: workspaceRunner(commands),
    })).rejects.toThrow(/process\.arch.*x64/u);

    expect(commands).toEqual([]);
    await expect(stat(cacheDirectory)).rejects.toMatchObject({code: "ENOENT"});
  });

  it("uses platform cache and persistent state directories", () => {
    expect(manageCacheDirectory(
      {MICROFEED_CACHE_DIR: "/custom/cache"},
      "linux",
      "/home/person",
    )).toBe("/custom/cache/manage");
    expect(manageCacheDirectory({}, "darwin", "/Users/person"))
      .toBe("/Users/person/Library/Caches/microfeed/manage");
    expect(manageCacheDirectory({}, "linux", "/home/person"))
      .toBe("/home/person/.cache/microfeed/manage");
    expect(manageCacheDirectory(
      {LOCALAPPDATA: "C:\\Users\\person\\AppData\\Local"},
      "win32",
      "C:\\Users\\person",
    )).toContain(path.join("microfeed", "manage"));

    expect(manageStateDirectory(
      {MICROFEED_CONFIG_DIR: "/custom/config"},
      "linux",
      "/home/person",
    )).toBe("/custom/config/manage");
    expect(manageStateDirectory(
      {XDG_CONFIG_HOME: "/xdg/config"},
      "linux",
      "/home/person",
    )).toBe("/xdg/config/microfeed/manage");
    expect(manageStateDirectory({}, "darwin", "/Users/person"))
      .toBe("/Users/person/.config/microfeed/manage");
    expect(manageStateDirectory({}, "win32", "C:\\Users\\person"))
      .toContain(path.join("AppData", "Roaming", "microfeed", "manage"));
  });

  it("copies the exact bundled release and prints a complete agent handoff", async () => {
    const root = await temporaryDirectory("microfeed-manage-bootstrap-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const stateDirectory = path.join(root, "state");
    const invocationDirectory = path.join(root, "empty-caller");
    const commands: RecordedCommand[] = [];
    const output: string[] = [];
    await mkdir(invocationDirectory);

    await expect(runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: (value) => output.push(value),
      packageVersion: "1.2.3",
      platform: "linux",
      invocationDirectory,
      runner: workspaceRunner(commands),
      stateDirectory,
      ...fixture,
    })).resolves.toBe(0);

    expect(commands.some(({executable}) =>
      executable === "git" || executable.includes("corepack")
    )).toBe(false);
    const install = commands.find(({args, executable}) =>
      executable === process.execPath && args[0] === fixture.yarnJavaScript
    );
    expect(install?.args).toEqual([
      fixture.yarnJavaScript,
      "install",
      "--immutable",
    ]);
    expect(install?.options.cwd).toBe(path.join(cacheDirectory, "repository"));
    expect(install?.options.env?.MICROFEED_YARN_JAVASCRIPT)
      .toBe(fixture.yarnJavaScript);
    expect(output.join("\n")).toContain("microfeed v1.2.3");
    expect(output.join("\n")).toContain("deploy-microfeed");
    expect(output.join("\n")).toContain(path.join("docs", "manage-cli.md"));
    expect(output.join("\n")).toContain(
      "npx @microfeed/cli manage accounts --json",
    );
    expect(output.join("\n")).toContain("Do not stop");
    await expect(readdir(invocationDirectory)).resolves.toEqual([]);
  });

  it("reuses verified source and forwards every argument from the caller", async () => {
    const root = await temporaryDirectory("microfeed-manage-forward-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const stateDirectory = path.join(root, "state");
    const invocationDirectory = path.join(root, "caller");
    const commands: RecordedCommand[] = [];
    const runner = workspaceRunner(commands, commandResult({exitCode: 17}));
    await mkdir(invocationDirectory);

    const options = {
      cacheDirectory,
      environment: {MICROFEED_TEST_MARKER: "preserved", PATH: "/usr/bin"},
      packageVersion: "1.2.3",
      platform: "linux" as const,
      runner,
      stateDirectory,
      ...fixture,
    };
    await runManageLauncher([], {...options, output: () => undefined});
    await writeFile(
      path.join(cacheDirectory, "repository", "untracked-sentinel"),
      "preserved",
    );
    commands.splice(0);
    await expect(runManageLauncher(
      ["deploy", "--instance", "personal", "--json"],
      {...options, invocationDirectory},
    )).resolves.toBe(17);

    await expect(readFile(
      path.join(cacheDirectory, "repository", "untracked-sentinel"),
      "utf8",
    )).resolves.toBe("preserved");
    const forwarded = commands.find(({args}) =>
      args.some((argument) =>
        argument.endsWith(path.join("manage-cli", "index.ts"))
      )
    );
    expect(forwarded?.executable).toBe(process.execPath);
    expect(forwarded?.args[0]).toBe(fixture.tsxJavaScript);
    expect(forwarded?.options.cwd).toBe(invocationDirectory);
    expect(forwarded?.options.env?.MICROFEED_STATE_DIRECTORY)
      .toBe(stateDirectory);
    expect(forwarded?.options.env?.MICROFEED_YARN_JAVASCRIPT)
      .toBe(fixture.yarnJavaScript);
    expect(forwarded?.options.env?.PATH).toBe("/usr/bin");
    expect(forwarded?.options.env?.MICROFEED_TEST_MARKER).toBe("preserved");
    expect(forwarded?.options.stdio).toBe("inherit");
    expect(forwarded?.args.slice(-4)).toEqual([
      "deploy",
      "--instance",
      "personal",
      "--json",
    ]);
    if (process.platform !== "win32") {
      expect((await stat(cacheDirectory)).mode & 0o777).toBe(0o700);
      expect((await stat(stateDirectory)).mode & 0o777).toBe(0o700);
    }
  });

  it("does not invoke a Windows command shim", async () => {
    const root = await temporaryDirectory("microfeed-manage-windows-");
    const fixture = await runtimeFixture(root);
    const commands: RecordedCommand[] = [];

    await runManageLauncher(["accounts", "--json"], {
      cacheDirectory: path.join(root, "cache"),
      environment: {PATH: "C:\\Program Files\\nodejs"},
      invocationDirectory: path.join(root, "caller"),
      packageVersion: "1.2.3",
      platform: "win32",
      runner: workspaceRunner(commands),
      stateDirectory: path.join(root, "state"),
      ...fixture,
    });

    const forwarded = commands.find(({args}) =>
      args.includes(path.join(root, "tsx.mjs"))
    );
    expect(forwarded?.executable).toBe(process.execPath);
    expect(forwarded?.args.slice(-2)).toEqual(["accounts", "--json"]);
    expect(commands.some(({executable}) => executable.endsWith(".cmd")))
      .toBe(false);
  });

  it("replaces only stale cached source and preserves deployment state", async () => {
    const root = await temporaryDirectory("microfeed-manage-refresh-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const repositoryDirectory = path.join(cacheDirectory, "repository");
    const stateDirectory = path.join(root, "state");
    await mkdir(repositoryDirectory, {recursive: true});
    await mkdir(stateDirectory, {recursive: true});
    await writeFile(
      path.join(repositoryDirectory, "package.json"),
      `${JSON.stringify({version: "1.0.0"})}\n`,
    );
    await writeFile(path.join(stateDirectory, "saved-instance"), "preserved");

    await runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: workspaceRunner([]),
      stateDirectory,
      ...fixture,
    });

    expect(JSON.parse(
      await readFile(path.join(repositoryDirectory, "package.json"), "utf8"),
    )).toEqual({name: "microfeed", version: "1.2.3"});
    await expect(readFile(path.join(stateDirectory, "saved-instance"), "utf8"))
      .resolves.toBe("preserved");
  });

  it("repairs modified cached source without touching saved state", async () => {
    const root = await temporaryDirectory("microfeed-manage-dirty-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const repositoryDirectory = path.join(cacheDirectory, "repository");
    const stateDirectory = path.join(root, "state");
    const options = {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux" as const,
      runner: workspaceRunner([]),
      stateDirectory,
      ...fixture,
    };
    await runManageLauncher([], options);
    await mkdir(stateDirectory, {recursive: true});
    await writeFile(path.join(stateDirectory, "saved-instance"), "preserved");
    await writeFile(path.join(repositoryDirectory, "package.json"), "changed\n");

    await runManageLauncher([], options);

    await expect(readFile(path.join(repositoryDirectory, "package.json"), "utf8"))
      .resolves.toContain('"version":"1.2.3"');
    await expect(readFile(path.join(stateDirectory, "saved-instance"), "utf8"))
      .resolves.toBe("preserved");
  });

  it("rejects concurrent setup and a damaged packaged runtime", async () => {
    const root = await temporaryDirectory("microfeed-manage-lock-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    await mkdir(path.join(cacheDirectory, ".setup-lock"), {recursive: true});
    const options = {
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux" as const,
      runner: workspaceRunner([]),
      stateDirectory: path.join(root, "state"),
      ...fixture,
    };
    await expect(runManageLauncher([], {cacheDirectory, ...options}))
      .rejects.toThrow(/Another microfeed management command/u);

    const activeCache = path.join(root, "active-lock");
    const activeLock = path.join(activeCache, ".setup-lock");
    await mkdir(activeLock, {recursive: true});
    await writeFile(
      path.join(activeLock, "owner.json"),
      `${JSON.stringify({pid: process.pid})}\n`,
    );
    const old = new Date(Date.now() - 2 * 60 * 60 * 1_000);
    await utimes(activeLock, old, old);
    await expect(runManageLauncher([], {
      cacheDirectory: activeCache,
      ...options,
    })).rejects.toThrow(/Another microfeed management command/u);

    const manifest = JSON.parse(await readFile(
      fixture.runtimeManifestPath,
      "utf8",
    )) as ManageRuntimeManifest;
    const packageEntry = manifest.files.find(({path: runtimePath}) =>
      runtimePath === "package.json"
    );
    expect(packageEntry).toBeDefined();
    await writeFile(
      path.join(fixture.runtimeDirectory, packageEntry!.sha256),
      "damaged\n",
    );
    await expect(runManageLauncher([], {
      cacheDirectory: path.join(root, "damaged-cache"),
      ...options,
    })).rejects.toThrow(/source bundled with @microfeed\/cli is damaged/u);
  });

  it("recovers an abandoned setup lock", async () => {
    const root = await temporaryDirectory("microfeed-manage-stale-lock-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const lockDirectory = path.join(cacheDirectory, ".setup-lock");
    await mkdir(lockDirectory, {recursive: true});
    const old = new Date(Date.now() - 2 * 60 * 60 * 1_000);
    await utimes(lockDirectory, old, old);

    await expect(runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: workspaceRunner([]),
      stateDirectory: path.join(root, "state"),
      ...fixture,
    })).resolves.toBe(0);
  });

  it("recovers an interrupted repository swap without copying again", async () => {
    const root = await temporaryDirectory("microfeed-manage-swap-");
    const fixture = await runtimeFixture(root);
    const cacheDirectory = path.join(root, "cache");
    const repository = path.join(cacheDirectory, "repository");
    const previous = path.join(cacheDirectory, ".repository-previous");
    const abandonedCandidate = path.join(cacheDirectory, ".repository-123-456");
    const options = {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux" as const,
      runner: workspaceRunner([]),
      stateDirectory: path.join(root, "state"),
      ...fixture,
    };
    await runManageLauncher([], options);
    await rename(repository, previous);
    await mkdir(abandonedCandidate, {recursive: true});
    await writeFile(path.join(previous, "untracked-sentinel"), "preserved");

    await runManageLauncher([], options);

    await expect(readFile(
      path.join(repository, "untracked-sentinel"),
      "utf8",
    )).resolves.toBe("preserved");
    expect(await readdir(cacheDirectory)).not.toContain(".repository-123-456");
  });

  it("preserves a child signal as its conventional exit code", async () => {
    if (process.platform === "win32") return;
    const result = await runManageProcess(
      process.execPath,
      ["-e", "process.kill(process.pid, 'SIGTERM')"],
      {stdio: "ignore"},
    );
    expect(result.signal).toBe("SIGTERM");
    expect(result.exitCode).toBe(143);
  });

  it("renders absolute handoff paths and the public command translation", () => {
    const repository = path.resolve("private", "cache", "microfeed");
    const output = manageAgentHandoff(repository, "2.0.0");
    expect(output).toContain(
      `\`${path.join(repository, ".agents", "skills", "deploy-microfeed", "SKILL.md")}\``,
    );
    expect(output).toContain("`npx @microfeed/cli manage …`");
    expect(output).toContain("final status check succeeds");
  });
});
