import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  filesystemPathToUrl,
  repositoryCommitSha,
  repositoryRoot,
  runCommand,
  runWrangler,
  runYarnScript,
} from "../../../manage-cli/lib/process";
import type {CommandRunner} from "../../../manage-cli/types";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("deployment source commit", () => {
  it("resolves the trusted repository HEAD before deployment", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: `${COMMIT}\n`,
    });

    await expect(repositoryCommitSha(runner)).resolves.toBe(COMMIT);
    expect(runner).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--verify", "HEAD"],
      {cwd: repositoryRoot},
    );
  });

  it("rejects output that is not a full Git SHA", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "0123456\n",
    });

    await expect(repositoryCommitSha(runner)).rejects.toThrow(
      "current Git commit",
    );
  });

  it("uses packaged release provenance without invoking Git", async () => {
    const sourceRoot = await mkdtemp(path.join(tmpdir(), "microfeed-source-"));
    temporaryDirectories.push(sourceRoot);
    await writeFile(
      path.join(sourceRoot, ".microfeed-runtime.json"),
      `${JSON.stringify({sourceCommit: COMMIT})}\n`,
    );
    const runner = vi.fn<CommandRunner>();

    await expect(repositoryCommitSha(runner, sourceRoot)).resolves.toBe(COMMIT);
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("filesystem URL conversion", () => {
  it("preserves Windows drive letters, spaces, and non-ASCII paths", () => {
    expect(filesystemPathToUrl(
      "C:\\Users\\系統預設\\AppData\\Roaming\\microfeed config\\wrangler.jsonc",
      "win32",
    )).toBe(
      "file:///C:/Users/%E7%B3%BB%E7%B5%B1%E9%A0%90%E8%A8%AD/AppData/" +
        "Roaming/microfeed%20config/wrangler.jsonc",
    );
  });

  it("keeps a cross-drive Wrangler configuration independent of the repository", () => {
    const repository = "E:\\microfeed-cli-cache\\manage\\repository";
    const configuration =
      "C:\\Users\\person\\AppData\\Roaming\\microfeed\\manage\\wrangler.jsonc";

    expect(path.win32.isAbsolute(path.win32.relative(
      repository,
      configuration,
    ))).toBe(true);
    expect(filesystemPathToUrl(configuration, "win32"))
      .toBe("file:///C:/Users/person/AppData/Roaming/microfeed/manage/wrangler.jsonc");
    expect(fileURLToPath(
      new URL(
        filesystemPathToUrl(configuration, "win32"),
        "file:///E:/microfeed-cli-cache/manage/repository/",
      ),
      {windows: true},
    )).toBe(configuration);
  });
});

describe("Yarn command execution", () => {
  it("uses the installed Yarn JavaScript instead of a command shim", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });
    await runYarnScript(runner, "build");

    const [executable, args, options] = runner.mock.calls[0]!;
    expect(executable).toContain(
      path.join("@yarnpkg", "cli-dist", "bin", "yarn.js"),
    );
    expect(args).toEqual(["build"]);
    expect(options).toEqual({cwd: repositoryRoot});
  });

  it("uses the Yarn bundled by the published launcher", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });
    await runYarnScript(runner, "build", {
      env: {MICROFEED_YARN_JAVASCRIPT: "/private/yarn.js"},
    });
    expect(runner).toHaveBeenCalledWith(
      "/private/yarn.js",
      ["build"],
      {
        cwd: repositoryRoot,
        env: {MICROFEED_YARN_JAVASCRIPT: "/private/yarn.js"},
      },
    );
  });
});

describe("Wrangler command execution", () => {
  it("uses the installed Wrangler JavaScript instead of a command shim", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });
    await runWrangler(runner, ["d1", "list", "--json"]);

    const [executable, args, options] = runner.mock.calls[0]!;
    expect(executable).toContain(path.join("wrangler", "bin", "wrangler.js"));
    expect(args).toEqual(["d1", "list", "--json"]);
    expect(options).toEqual({cwd: repositoryRoot});
  });
});

describe("JavaScript command execution", () => {
  it("runs a JavaScript entry point with Node without executable permissions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "microfeed-node-command-"));
    temporaryDirectories.push(root);
    const entry = path.join(root, "command.mjs");
    await writeFile(
      entry,
      "process.stdout.write(process.argv.slice(2).join('|'));\n",
      {mode: 0o600},
    );

    await expect(runCommand(entry, ["one", "two"])).resolves.toMatchObject({
      exitCode: 0,
      stdout: "one|two",
    });
  });
});
