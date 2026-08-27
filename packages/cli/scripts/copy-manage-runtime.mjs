import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

const run = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "../..");
const runtimeDirectory = path.join(packageRoot, "dist/manage-runtime-files");
const legacyRuntimeDirectory = path.join(packageRoot, "dist/manage-runtime");
const manifestPath = path.join(
  packageRoot,
  "dist/manage-runtime-manifest.json",
);

const runtimePaths = [
  ".agents/skills/deploy-microfeed",
  ".yarnrc.yml",
  "LICENSE",
  "astro.config.ts",
  "components.json",
  "docs/manage-cli.md",
  "manage-cli",
  "migrations",
  "package.json",
  "packages",
  "postcss.config.ts",
  "public",
  "redocly.yaml",
  "scripts",
  "src",
  "tests",
  "themes",
  "tsconfig.json",
  "vitest.config.ts",
  "vitest.worker.config.ts",
  "wrangler.jsonc",
  "wrangler.template.jsonc",
  "yarn.lock",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const [{stdout: trackedOutput}, {stdout: commitOutput}] = await Promise.all([
  run("git", ["ls-files", "-z", "--", ...runtimePaths], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  }),
  run("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }),
]);
const files = trackedOutput
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();
const sourceCommit = commitOutput.trim().toLowerCase();
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error("Could not determine the deployment source commit.");
}
if (files.length === 0) {
  throw new Error("No tracked deployment runtime files were found.");
}

const [rootPackage, cliPackage] = await Promise.all([
  readFile(path.join(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(path.join(packageRoot, "package.json"), "utf8").then(JSON.parse),
]);
if (!rootPackage.version || rootPackage.version !== cliPackage.version) {
  throw new Error(
    "The application and @microfeed/cli versions must match before packing.",
  );
}

await rm(runtimeDirectory, {force: true, recursive: true});
await rm(legacyRuntimeDirectory, {force: true, recursive: true});
await rm(manifestPath, {force: true});
await mkdir(runtimeDirectory, {recursive: true});

const manifestFiles = [];
for (const relativePath of files) {
  if (
    path.posix.isAbsolute(relativePath) ||
    relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe deployment runtime path: ${relativePath}`);
  }
  const source = path.join(repositoryRoot, relativePath);
  const contents = await readFile(source);
  const metadata = await stat(source);
  if (!metadata.isFile()) {
    throw new Error(`Deployment runtime entry is not a file: ${relativePath}`);
  }
  const digest = sha256(contents);
  await writeFile(path.join(runtimeDirectory, digest), contents, {mode: 0o600});
  manifestFiles.push({
    path: relativePath,
    sha256: digest,
    size: metadata.size,
  });
}

await writeFile(
  manifestPath,
  `${JSON.stringify({
    files: manifestFiles,
    schemaVersion: 1,
    sourceCommit,
    version: rootPackage.version,
  }, null, 2)}\n`,
  "utf8",
);
