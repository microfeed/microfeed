import {spawn} from "node:child_process";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

import {BUNDLED_THEME_CATALOG} from "../src/shared/themes/BundledThemeCatalog";

const repositoryRoot = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
const require = createRequire(import.meta.url);
const yarnJavaScript = require.resolve("@yarnpkg/cli-dist/bin/yarn.js");

async function run(
  executable: string,
  args: string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        signal
          ? `${executable} was terminated by ${signal}.`
          : `${executable} exited with status ${code ?? "unknown"}.`,
      ));
    });
  });
}

async function packageWorkspace(directory: string): Promise<string> {
  const filename = path.join(
    repositoryRoot,
    "themes",
    directory,
    "package.json",
  );
  const parsed = JSON.parse(await readFile(filename, "utf8")) as {
    name?: unknown;
  };
  if (typeof parsed.name !== "string" || !parsed.name) {
    throw new Error(`${filename} must declare a package name.`);
  }
  return parsed.name;
}

export async function checkBundledThemes(
  build: boolean,
  test: boolean,
): Promise<void> {
  for (const entry of BUNDLED_THEME_CATALOG) {
    const directory = path.join("themes", entry.directory);
    if (build) {
      await run(process.execPath, [
        yarnJavaScript,
        "workspace",
        await packageWorkspace(entry.directory),
        "check",
      ]);
    }
    if (test) {
      await run(process.execPath, [
        "packages/theme-kit/dist/cli.js",
        "test",
        directory,
        "--json",
      ]);
    }
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (
    args.size === 0 ||
    [...args].some((argument) => !["--build", "--test"].includes(argument))
  ) {
    throw new Error("Use --build, --test, or both.");
  }
  await checkBundledThemes(args.has("--build"), args.has("--test"));
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
