import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {
  CommandResult,
  CommandRunner,
  RunOptions,
} from "../types";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const runCommand: CommandRunner = (
  executable,
  args,
  options: RunOptions = {},
) => new Promise((resolve, reject) => {
  const child = spawn(executable, [...args], {
    cwd: options.cwd ?? repositoryRoot,
    env: {...process.env, ...options.env},
    shell: false,
    stdio: options.interactive ? "inherit" : ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  if (!options.interactive) {
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    } else {
      child.stdin?.end();
    }
  }

  child.once("error", reject);
  child.once("close", (exitCode) => {
    const result: CommandResult = {
      exitCode: exitCode ?? 1,
      stderr,
      stdout,
    };
    if (result.exitCode !== 0 && !options.allowFailure) {
      const detail = stderr.trim() || stdout.trim();
      reject(new Error(
        `${path.basename(executable)} ${args.join(" ")} failed` +
        (detail ? `:\n${detail}` : "."),
      ));
      return;
    }
    resolve(result);
  });
});

function localBinary(name: string): string {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return path.join(repositoryRoot, "node_modules", ".bin", `${name}${suffix}`);
}

export function runWrangler(
  runner: CommandRunner,
  args: readonly string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  return runner(localBinary("wrangler"), args, {
    cwd: repositoryRoot,
    ...options,
  });
}

export function runYarnScript(
  runner: CommandRunner,
  script: string,
  options: RunOptions = {},
): Promise<CommandResult> {
  const executable = process.platform === "win32" ? "yarn.cmd" : "yarn";
  return runner(executable, [script], {
    cwd: repositoryRoot,
    ...options,
  });
}

export function openUrl(
  runner: CommandRunner,
  url: string,
): Promise<CommandResult> {
  if (process.platform === "darwin") {
    return runner("open", [url], {interactive: true});
  }
  if (process.platform === "win32") {
    return runner("cmd.exe", ["/c", "start", "", url], {interactive: true});
  }
  return runner("xdg-open", [url], {interactive: true});
}
