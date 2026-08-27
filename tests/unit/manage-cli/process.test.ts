import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  repositoryCommitSha,
  repositoryRoot,
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

describe("Yarn command execution", () => {
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
      process.execPath,
      ["/private/yarn.js", "build"],
      {
        cwd: repositoryRoot,
        env: {MICROFEED_YARN_JAVASCRIPT: "/private/yarn.js"},
      },
    );
  });
});
