import {spawn} from "node:child_process";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
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
const require = createRequire(import.meta.url);

export function relativePathFromDirectory(
  directory: string,
  filename: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const relative = platformPath.relative(directory, filename);
  if (platformPath.isAbsolute(relative)) return undefined;
  return relative.replaceAll(platformPath.sep, "/") || ".";
}

interface PackageBinaryMetadata {
  bin?: string | Record<string, string>;
}

function packageBinaryJavaScript(
  packageName: string,
  binaryName: string,
): string {
  const metadataPath = require.resolve(`${packageName}/package.json`);
  const metadata = require(metadataPath) as PackageBinaryMetadata;
  const binary = typeof metadata.bin === "string"
    ? metadata.bin
    : metadata.bin?.[binaryName];
  if (!binary) {
    throw new Error(
      `The installed ${packageName} package does not provide ${binaryName}.`,
    );
  }
  return path.resolve(path.dirname(metadataPath), binary);
}

export const runCommand: CommandRunner = (
  executable,
  args,
  options: RunOptions = {},
) => new Promise((resolve, reject) => {
  const runsWithNode = [".cjs", ".js", ".mjs"].includes(
    path.extname(executable).toLowerCase(),
  );
  const child = spawn(
    runsWithNode ? process.execPath : executable,
    runsWithNode ? [executable, ...args] : [...args],
    {
      cwd: options.cwd ?? repositoryRoot,
      env: {...process.env, ...options.env},
      shell: false,
      stdio: options.interactive ? "inherit" : ["pipe", "pipe", "pipe"],
    },
  );
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

export function runWrangler(
  runner: CommandRunner,
  args: readonly string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  // JavaScript entry points are executed directly with Node by runCommand, so
  // Windows never needs a command shim or shell parsing.
  return runner(packageBinaryJavaScript("wrangler", "wrangler"), args, {
    cwd: repositoryRoot,
    ...options,
  });
}

export function runYarnScript(
  runner: CommandRunner,
  script: string,
  options: RunOptions = {},
): Promise<CommandResult> {
  const yarnJavaScript = (
    options.env?.MICROFEED_YARN_JAVASCRIPT ??
    process.env.MICROFEED_YARN_JAVASCRIPT
  )?.trim() || packageBinaryJavaScript("@yarnpkg/cli-dist", "yarn");
  return runner(yarnJavaScript, [script], {
    cwd: repositoryRoot,
    ...options,
  });
}

const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;

export async function repositoryCommitSha(
  runner: CommandRunner,
  sourceRoot = repositoryRoot,
): Promise<string> {
  const markerPath = path.join(sourceRoot, ".microfeed-runtime.json");
  try {
    const marker = JSON.parse(await readFile(markerPath, "utf8")) as {
      sourceCommit?: unknown;
    };
    if (
      typeof marker.sourceCommit !== "string" ||
      !FULL_GIT_SHA.test(marker.sourceCommit)
    ) {
      throw new Error(
        "The packaged microfeed deployment source commit is invalid.",
      );
    }
    return marker.sourceCommit;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const result = await runner(
    "git",
    ["rev-parse", "--verify", "HEAD"],
    {cwd: sourceRoot},
  );
  const sha = result.stdout.trim().toLowerCase();
  if (!FULL_GIT_SHA.test(sha)) {
    throw new Error(
      "Unable to determine the current Git commit for this deployment.",
    );
  }
  return sha;
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
