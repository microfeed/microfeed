import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

import {
  recordBundledThemeReleases,
  verifyBundledThemeReleases,
} from "../manage-cli/lib/bundled-theme-release";

export async function checkBundledThemeRelease(
  repositoryRoot: string,
  record: boolean,
): Promise<string> {
  const results = record
    ? await recordBundledThemeReleases(repositoryRoot)
    : (await verifyBundledThemeReleases(repositoryRoot)).map((identity) => ({
      identity,
      recorded: false,
    }));
  return results.map((result) => {
    const action = record && result.recorded ? "Recorded" : "Verified";
    return `${action} ${result.identity.packageId}@${result.identity.version} ` +
      `(${result.identity.checksumSha256}).`;
  }).join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--record") || args.length > 1) {
    throw new Error(
      "Use `yarn theme:release-check` or `yarn theme:release`.",
    );
  }
  const repositoryRoot = path.resolve(
    fileURLToPath(new URL("..", import.meta.url)),
  );
  process.stdout.write(
    `${await checkBundledThemeRelease(repositoryRoot, args[0] === "--record")}\n`,
  );
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
