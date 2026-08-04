import {describe, expect, it, vi} from "vitest";

import {
  repositoryCommitSha,
  repositoryRoot,
} from "../../../manage-cli/lib/process";
import type {CommandRunner} from "../../../manage-cli/types";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

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
});
