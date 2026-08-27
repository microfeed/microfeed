import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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
  manageStateDirectory,
  runManageLauncher,
  runManageProcess,
} from "../../../packages/cli/src/manage";

const temporaryDirectories: string[] = [];

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

function workspaceRunner(
  version: string,
  commands: RecordedCommand[],
  finalResult: ManageCommandResult = commandResult(),
): ManageCommandRunner {
  return async (executable, args, options = {}) => {
    commands.push({args: [...args], executable, options});
    if (executable === "git" && args[0] === "clone") {
      const destination = args.at(-1)!;
      await mkdir(destination, {recursive: true});
      await writeFile(
        path.join(destination, "package.json"),
        `${JSON.stringify({version})}\n`,
      );
      return commandResult();
    }
    if (executable === "git" && args.includes("rev-parse")) {
      return commandResult({stdout: "0123456789abcdef\n"});
    }
    if (executable === "git" && args.includes("status")) {
      return commandResult();
    }
    if (executable.endsWith(`${path.sep}tsx`)) return finalResult;
    return commandResult({stdout: `${path.basename(executable)} 1.0.0\n`});
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("clone-free management launcher", () => {
  it("uses platform cache and persistent state directories", () => {
    expect(manageCacheDirectory(
      {MICROFEED_CACHE_DIR: "/custom/cache"},
      "linux",
      "/home/person",
    )).toBe(path.resolve("/custom/cache", "manage"));
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
    )).toBe(path.resolve("/custom/config", "manage"));
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

  it("clones the exact release and prints a complete agent handoff", async () => {
    const root = await temporaryDirectory("microfeed-manage-bootstrap-");
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
      runner: workspaceRunner("1.2.3", commands),
      stateDirectory,
    })).resolves.toBe(0);

    const clone = commands.find(({args, executable}) =>
      executable === "git" && args[0] === "clone"
    );
    expect(clone?.args).toEqual([
      "clone",
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      "v1.2.3",
      "https://github.com/microfeed/microfeed.git",
      expect.stringContaining(".repository-"),
    ]);
    const install = commands.find(({args}) => args[0] === "install");
    expect(install?.args).toEqual(["install", "--immutable"]);
    expect(install?.options.cwd).toBe(path.join(cacheDirectory, "repository"));
    const corepack = commands.find(({args, executable}) =>
      executable === "corepack" && args[0] === "enable"
    );
    expect(corepack?.args).toEqual([
      "enable",
      "--install-directory",
      path.join(cacheDirectory, "bin"),
      "yarn",
    ]);
    expect(corepack?.options.env?.COREPACK_HOME)
      .toBe(path.join(cacheDirectory, "corepack"));
    expect(output.join("\n")).toContain("microfeed v1.2.3");
    expect(output.join("\n")).toContain("deploy-microfeed");
    expect(output.join("\n")).toContain("docs/manage-cli.md");
    expect(output.join("\n")).toContain(
      "npx @microfeed/cli manage accounts --json",
    );
    expect(output.join("\n")).toContain("Do not stop");
    await expect(readdir(invocationDirectory)).resolves.toEqual([]);
  });

  it("reuses the checkout and forwards every argument from the original directory", async () => {
    const root = await temporaryDirectory("microfeed-manage-forward-");
    const cacheDirectory = path.join(root, "cache");
    const stateDirectory = path.join(root, "state");
    const invocationDirectory = path.join(root, "caller");
    const commands: RecordedCommand[] = [];
    const runner = workspaceRunner(
      "1.2.3",
      commands,
      commandResult({exitCode: 17}),
    );
    await mkdir(invocationDirectory);

    await runManageLauncher([], {
      cacheDirectory,
      environment: {MICROFEED_TEST_MARKER: "preserved", PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner,
      stateDirectory,
    });
    commands.splice(0);
    await expect(runManageLauncher(
      ["deploy", "--instance", "personal", "--json"],
      {
        cacheDirectory,
        environment: {MICROFEED_TEST_MARKER: "preserved", PATH: "/usr/bin"},
        invocationDirectory,
        packageVersion: "1.2.3",
        platform: "linux",
        runner,
        stateDirectory,
      },
    )).resolves.toBe(17);

    expect(commands.some(({args}) => args[0] === "clone")).toBe(false);
    const forwarded = commands.find(({executable}) =>
      executable.endsWith(`${path.sep}tsx`)
    );
    expect(forwarded?.options.cwd).toBe(invocationDirectory);
    expect(forwarded?.options.env?.MICROFEED_STATE_DIRECTORY)
      .toBe(stateDirectory);
    expect(forwarded?.options.env?.PATH?.split(path.delimiter)[0])
      .toBe(path.join(cacheDirectory, "bin"));
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

  it("replaces only stale cached source and preserves deployment state", async () => {
    const root = await temporaryDirectory("microfeed-manage-refresh-");
    const cacheDirectory = path.join(root, "cache");
    const repositoryDirectory = path.join(cacheDirectory, "repository");
    const stateDirectory = path.join(root, "state");
    const commands: RecordedCommand[] = [];
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
      runner: workspaceRunner("1.2.3", commands),
      stateDirectory,
    });

    expect(JSON.parse(
      await readFile(path.join(repositoryDirectory, "package.json"), "utf8"),
    )).toEqual({version: "1.2.3"});
    await expect(readFile(path.join(stateDirectory, "saved-instance"), "utf8"))
      .resolves.toBe("preserved");
  });

  it("repairs a dirty cached checkout without touching saved state", async () => {
    const root = await temporaryDirectory("microfeed-manage-dirty-");
    const cacheDirectory = path.join(root, "cache");
    const repositoryDirectory = path.join(cacheDirectory, "repository");
    const stateDirectory = path.join(root, "state");
    const commands: RecordedCommand[] = [];
    let statusChecks = 0;
    const baseRunner = workspaceRunner("1.2.3", commands);
    const runner: ManageCommandRunner = async (executable, args, options) => {
      if (executable === "git" && args.includes("status")) {
        statusChecks += 1;
        if (statusChecks === 1) return commandResult({stdout: "?? changed\n"});
      }
      return await baseRunner(executable, args, options);
    };
    await mkdir(repositoryDirectory, {recursive: true});
    await mkdir(stateDirectory, {recursive: true});
    await writeFile(
      path.join(repositoryDirectory, "package.json"),
      `${JSON.stringify({version: "1.2.3"})}\n`,
    );
    await writeFile(path.join(stateDirectory, "saved-instance"), "preserved");

    await runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner,
      stateDirectory,
    });

    expect(commands.some(({args}) => args[0] === "clone")).toBe(true);
    await expect(readFile(path.join(stateDirectory, "saved-instance"), "utf8"))
      .resolves.toBe("preserved");
  });

  it("rejects concurrent setup and reports missing prerequisites clearly", async () => {
    const root = await temporaryDirectory("microfeed-manage-lock-");
    const cacheDirectory = path.join(root, "cache");
    await mkdir(path.join(cacheDirectory, ".setup-lock"), {recursive: true});
    await expect(runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: workspaceRunner("1.2.3", []),
      stateDirectory: path.join(root, "state"),
    })).rejects.toThrow(/Another microfeed management command/u);

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
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: workspaceRunner("1.2.3", []),
      stateDirectory: path.join(root, "state"),
    })).rejects.toThrow(/Another microfeed management command/u);

    const missingGit: ManageCommandRunner = async (executable) => {
      if (executable === "git") {
        throw Object.assign(new Error("spawn git ENOENT"), {code: "ENOENT"});
      }
      return commandResult();
    };
    await expect(runManageLauncher([], {
      cacheDirectory: path.join(root, "missing-git"),
      environment: {PATH: ""},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: missingGit,
      stateDirectory: path.join(root, "state"),
    })).rejects.toThrow(/Git is required/u);

    const missingCorepack: ManageCommandRunner = async (executable) => {
      if (executable === "corepack") {
        throw Object.assign(
          new Error("spawn corepack ENOENT"),
          {code: "ENOENT"},
        );
      }
      return commandResult();
    };
    await expect(runManageLauncher([], {
      cacheDirectory: path.join(root, "missing-corepack"),
      environment: {PATH: ""},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: missingCorepack,
      stateDirectory: path.join(root, "state"),
    })).rejects.toThrow(/Corepack is required/u);

    const missingNpm: ManageCommandRunner = async (executable) => {
      if (executable === "npm") {
        throw Object.assign(new Error("spawn npm ENOENT"), {code: "ENOENT"});
      }
      return commandResult();
    };
    await expect(runManageLauncher([], {
      cacheDirectory: path.join(root, "missing-npm"),
      environment: {PATH: ""},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: missingNpm,
      stateDirectory: path.join(root, "state"),
    })).rejects.toThrow(/npm is required/u);
  });

  it("recovers an abandoned setup lock", async () => {
    const root = await temporaryDirectory("microfeed-manage-stale-lock-");
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
      runner: workspaceRunner("1.2.3", []),
      stateDirectory: path.join(root, "state"),
    })).resolves.toBe(0);
  });

  it("recovers an interrupted repository swap without downloading again", async () => {
    const root = await temporaryDirectory("microfeed-manage-swap-");
    const cacheDirectory = path.join(root, "cache");
    const previous = path.join(cacheDirectory, ".repository-previous");
    const abandonedCandidate = path.join(cacheDirectory, ".repository-123-456");
    const commands: RecordedCommand[] = [];
    await mkdir(previous, {recursive: true});
    await mkdir(abandonedCandidate, {recursive: true});
    await writeFile(
      path.join(previous, "package.json"),
      `${JSON.stringify({version: "1.2.3"})}\n`,
    );

    await runManageLauncher([], {
      cacheDirectory,
      environment: {PATH: "/usr/bin"},
      output: () => undefined,
      packageVersion: "1.2.3",
      platform: "linux",
      runner: workspaceRunner("1.2.3", commands),
      stateDirectory: path.join(root, "state"),
    });

    expect(commands.some(({args}) => args[0] === "clone")).toBe(false);
    await expect(readFile(
      path.join(cacheDirectory, "repository", "package.json"),
      "utf8",
    )).resolves.toContain('"version":"1.2.3"');
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
    const output = manageAgentHandoff("/private/cache/microfeed", "2.0.0");
    expect(output).toContain(
      "`/private/cache/microfeed/.agents/skills/deploy-microfeed/SKILL.md`",
    );
    expect(output).toContain("`npx @microfeed/cli manage …`");
    expect(output).toContain("final status check succeeds");
  });
});
