import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import {existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

import {x as extractTar} from "tar";
import {CLI_HELP_TOPICS, renderCliHelp} from "../packages/cli/src/help";
import {HELP} from "../packages/cli/src/index";

const require = createRequire(import.meta.url);
const yarnJavaScript = require.resolve("@yarnpkg/cli-dist/bin/yarn.js");

function npmJavaScript(binary: "npm" | "npx"): string {
  const filename = `${binary}-cli.js`;
  const searchDirectories = [
    path.dirname(process.execPath),
    ...(process.env.PATH ?? "").split(path.delimiter),
  ].filter(Boolean);
  for (const directory of searchDirectories) {
    const candidate = path.join(directory, "node_modules", "npm", "bin", filename);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not locate ${filename}. Install npm alongside Node.js and rerun the check.`,
  );
}

function run(
  command: string,
  args: string[],
  cwd = process.cwd(),
  environment: Record<string, string | undefined> = {},
): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      ...environment,
    } as NodeJS.ProcessEnv,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function runYarn(
  args: string[],
  cwd = process.cwd(),
  environment: Record<string, string | undefined> = {},
): string {
  return run(process.execPath, [yarnJavaScript, ...args], cwd, environment);
}

const temporary = await mkdtemp(path.join(tmpdir(), "microfeed-cli-pack-"));
try {
  const rootPackage = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as {version: string};
  const archive = path.join(temporary, "microfeed-cli.tgz");
  runYarn([
    "workspace",
    "@microfeed/cli",
    "pack",
    "--out",
    archive,
  ]);
  await extractTar({cwd: temporary, file: archive});
  try {
    await readFile(path.join(
      temporary,
      "package/.microfeed/webhooks/endpoint1/README.md",
    ));
    throw new Error("The packed CLI contains a local .microfeed workspace.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const packedPackage = JSON.parse(
    await readFile(path.join(temporary, "package", "package.json"), "utf8"),
  ) as {
    bin?: {microfeed?: string};
    bugs?: {url?: string};
    dependencies?: Record<string, string>;
    homepage?: string;
    keywords?: string[];
    name?: string;
    publishConfig?: {access?: string; registry?: string};
    repository?: {directory?: string; type?: string; url?: string};
    version?: string;
  };
  if (packedPackage.name !== "@microfeed/cli" ||
      packedPackage.version !== rootPackage.version ||
      packedPackage.bin?.microfeed !== "dist/index.js" ||
      packedPackage.dependencies?.["@yarnpkg/cli-dist"] !== "4.18.0") {
    throw new Error(
      "The packed CLI has stale release metadata or deployment dependencies.",
    );
  }
  if (packedPackage.homepage !== "https://docs.microfeed.org/microfeed-cli/" ||
      packedPackage.bugs?.url !==
        "https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug" ||
      !packedPackage.keywords?.includes("headless cms") ||
      packedPackage.repository?.directory !== "packages/cli" ||
      packedPackage.repository?.type !== "git" ||
      packedPackage.repository?.url !==
        "git+https://github.com/microfeed/microfeed.git" ||
      packedPackage.publishConfig?.access !== "public" ||
      packedPackage.publishConfig?.registry !== "https://registry.npmjs.org") {
    throw new Error("The packed CLI is missing its npm discovery metadata.");
  }
  const [rootLicense, packedLicense] = await Promise.all([
    readFile(path.join(process.cwd(), "LICENSE"), "utf8"),
    readFile(path.join(temporary, "package", "LICENSE"), "utf8"),
  ]);
  if (packedLicense !== rootLicense) {
    throw new Error("The packed CLI license differs from the repository license.");
  }
  const [repositorySkill, packedSkill, packedSkillMetadata] = await Promise.all([
    readFile(path.join(
      process.cwd(),
      ".agents/skills/manage-microfeed-content/SKILL.md",
    ), "utf8"),
    readFile(path.join(
      temporary,
      "package/dist/skills/manage-microfeed-content/SKILL.md",
    ), "utf8"),
    readFile(path.join(
      temporary,
      "package/dist/skills/manage-microfeed-content/agents/openai.yaml",
    ), "utf8"),
  ]);
  if (packedSkill !== repositorySkill ||
      !packedSkill.includes("--attachment-file") ||
      !packedSkill.includes("media upload") ||
      !packedSkill.includes("RSS enclosure") ||
      !packedSkillMetadata.includes("Manage microfeed content")) {
    throw new Error("The packed content-management skill is missing or stale.");
  }
  const packedJavascriptStarter = await readFile(path.join(
    temporary,
    "package/templates/webhook/javascript/server.cjs",
  ), "utf8");
  const packedJavascriptLock = await readFile(path.join(
    temporary,
    "package/templates/webhook/javascript/yarn.lock",
  ), "utf8");
  const packedJavascriptPackage = JSON.parse(await readFile(path.join(
    temporary,
    "package/templates/webhook/javascript/package.json",
  ), "utf8")) as {dependencies?: Record<string, string>};
  const repositoryJavascriptStarter = await readFile(path.join(
    process.cwd(),
    "packages/cli/templates/webhook/javascript/server.cjs",
  ), "utf8");
  if (packedJavascriptStarter !== repositoryJavascriptStarter) {
    throw new Error("The packed webhook starter is missing or stale.");
  }
  if (packedJavascriptLock !== "") {
    throw new Error("The packed webhook starter is missing its empty Yarn project boundary.");
  }
  if (packedJavascriptPackage.dependencies?.express !== "5.2.1" ||
      packedJavascriptPackage.dependencies?.standardwebhooks !== "1.0.0") {
    throw new Error("The packed JavaScript webhook starter dependencies are stale.");
  }

  const packedHelp = run(process.execPath, [
    path.join(temporary, "package", "dist", "index.js"),
    "--help",
  ]);
  if (HELP !== packedHelp) {
    throw new Error(
      `Workspace and packed CLI help output diverged (${HELP.length} !== ${packedHelp.length}).`,
    );
  }
  for (const topic of CLI_HELP_TOPICS) {
    const expected = renderCliHelp(topic.path);
    const actual = run(process.execPath, [
      path.join(temporary, "package", "dist", "index.js"),
      ...topic.path,
      "--help",
    ]);
    if (expected !== actual) {
      throw new Error(
        `Packed CLI help diverged for ${topic.path.join(" ")} (${expected.length} !== ${actual.length}).`,
      );
    }
  }

  const project = path.join(temporary, "consumer");
  await mkdir(project);
  await writeFile(path.join(project, "package.json"), JSON.stringify({
    devDependencies: {"@microfeed/cli": `file:${archive}`},
    packageManager: "yarn@4.18.0",
    private: true,
  }), "utf8");
  runYarn(["install"], project);
  const projectHelp = runYarn(["microfeed", "--help"], project);
  if (HELP !== projectHelp) {
    throw new Error("A project-local @microfeed/cli behaves differently.");
  }
  const expectedCreateHelp = renderCliHelp(["item", "create"]);
  const projectCreateHelp = runYarn(
    ["microfeed", "item", "create", "--help"],
    project,
  );
  if (expectedCreateHelp !== projectCreateHelp) {
    throw new Error("Project-local item create help behaves differently.");
  }
  const projectScaffold = path.join(
    project,
    ".microfeed",
    "webhooks",
    "endpoint1",
  );
  const projectScaffoldResult = JSON.parse(runYarn(
    ["microfeed", "webhook", "scaffold", projectScaffold, "--json"],
    project,
  )) as {directory?: string; language?: string};
  if (projectScaffoldResult.directory !== projectScaffold ||
      projectScaffoldResult.language !== "javascript") {
    throw new Error("Project-local webhook scaffold output is invalid.");
  }
  if (JSON.stringify((await readdir(projectScaffold)).sort()) !== JSON.stringify([
    ".env.example",
    ".gitignore",
    "README.md",
    "package.json",
    "server.cjs",
    "yarn.lock",
  ])) {
    throw new Error("The packed JavaScript webhook starter file set is incomplete.");
  }
  runYarn(["install"], projectScaffold);
  const installedStarterLock = await readFile(
    path.join(projectScaffold, "yarn.lock"),
    "utf8",
  );
  if (!installedStarterLock.includes(
    'standardwebhooks: "npm:1.0.0"',
  ) || !installedStarterLock.includes(
    'resolution: "standardwebhooks@npm:1.0.0"',
  )) {
    throw new Error("The nested JavaScript webhook starter cannot install independently.");
  }

  const dlxHelp = runYarn([
    "dlx",
    "--package",
    `@microfeed/cli@file:${archive}`,
    "microfeed",
    "--help",
  ], temporary);
  // Yarn reports the temporary package resolution before running the binary.
  if (!dlxHelp.endsWith(HELP)) {
    throw new Error("The yarn dlx @microfeed/cli behavior diverged.");
  }
  const expectedManageHelp = renderCliHelp(["manage"]);
  const dlxManageHelp = runYarn([
    "dlx",
    "--package",
    `@microfeed/cli@file:${archive}`,
    "microfeed",
    "manage",
    "--help",
  ], temporary);
  if (!dlxManageHelp.endsWith(expectedManageHelp)) {
    throw new Error("The packed source-code-free management help diverged.");
  }

  const npmConsumer = path.join(temporary, "npm-consumer");
  await mkdir(npmConsumer);
  await writeFile(path.join(npmConsumer, "package.json"), JSON.stringify({
    private: true,
  }));
  run(process.execPath, [npmJavaScript("npm"),
    "install",
    "--ignore-scripts",
    "--omit=optional",
    archive,
  ], npmConsumer);
  const npxManageHelp = run(process.execPath, [npmJavaScript("npx"),
    "--no-install",
    "microfeed",
    "manage",
    "--help",
  ], npmConsumer);
  if (npxManageHelp !== expectedManageHelp) {
    throw new Error("The npx @microfeed/cli management help diverged.");
  }

  const runtimeManifest = JSON.parse(await readFile(path.join(
    temporary,
    "package/dist/manage-runtime-manifest.json",
  ), "utf8")) as {
    files?: Array<{path?: string; sha256?: string; size?: number}>;
    schemaVersion?: number;
    sourceCommit?: string;
    version?: string;
  };
  const runtimePaths = new Set(
    runtimeManifest.files?.map(({path: runtimePath}) => runtimePath) ?? [],
  );
  if (runtimeManifest.schemaVersion !== 1 ||
      runtimeManifest.version !== rootPackage.version ||
      !/^[0-9a-f]{40}$/u.test(runtimeManifest.sourceCommit ?? "") ||
      !runtimePaths.has("package.json") ||
      !runtimePaths.has("manage-cli/index.ts") ||
      !runtimePaths.has("docs/manage-cli.md") ||
      !runtimePaths.has(".agents/skills/deploy-microfeed/SKILL.md") ||
      [...runtimePaths].some((runtimePath) =>
        runtimePath?.startsWith("docs/") && runtimePath !== "docs/manage-cli.md"
      )) {
    throw new Error("The packed deployment runtime is incomplete or oversized.");
  }
  for (const file of runtimeManifest.files ?? []) {
    if (!file.sha256 || !Number.isSafeInteger(file.size)) {
      throw new Error("The packed deployment runtime manifest is invalid.");
    }
    const payload = await readFile(path.join(
      temporary,
      "package/dist/manage-runtime-files",
      file.sha256,
    ));
    if (payload.byteLength !== file.size) {
      throw new Error(`The packed deployment source is damaged: ${file.path}`);
    }
  }
  const packageEntry = runtimeManifest.files?.find(({path: runtimePath}) =>
    runtimePath === "package.json"
  );
  if (!packageEntry?.sha256) {
    throw new Error("The packed deployment source has no package metadata.");
  }
  const packedRuntimePackage = JSON.parse(await readFile(path.join(
    temporary,
    "package/dist/manage-runtime-files",
    packageEntry.sha256,
  ), "utf8")) as {version?: string};
  if (packedRuntimePackage.version !== rootPackage.version) {
    throw new Error("The packed deployment source version is stale.");
  }

  const packedManage = await import(pathToFileURL(path.join(
    temporary,
    "package/dist/manage.js",
  )).href);
  const handoffOutput: string[] = [];
  const cacheDirectory = path.join(temporary, "launcher-cache");
  const handoffExitCode = await packedManage.runManageLauncher([], {
    cacheDirectory,
    environment: {PATH: process.env.PATH},
    output: (value: string) => handoffOutput.push(value),
    packageVersion: rootPackage.version,
    runner: async () => ({
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
    }),
    stateDirectory: path.join(temporary, "launcher-config"),
    tsxJavaScript: path.join(temporary, "fake-tsx.mjs"),
    yarnJavaScript: path.join(temporary, "fake-yarn.js"),
  });
  const handoff = handoffOutput.join("\n");
  if (handoffExitCode !== 0 ||
      !handoff.includes(`microfeed v${rootPackage.version}`) ||
      !handoff.includes(path.join("deploy-microfeed", "SKILL.md")) ||
      !handoff.includes(path.join("docs", "manage-cli.md")) ||
      !handoff.includes("npx @microfeed/cli manage accounts --json")) {
    throw new Error("The packed coding-agent handoff is incomplete.");
  }
  const dlxScaffold = path.join(temporary, "dlx-scaffold");
  const dlxScaffoldOutput = runYarn([
    "dlx",
    "--package",
    `@microfeed/cli@file:${archive}`,
    "microfeed",
    "webhook",
    "scaffold",
    dlxScaffold,
    "--language",
    "python",
    "--json",
  ], temporary);
  const dlxScaffoldResult = JSON.parse(
    dlxScaffoldOutput.slice(dlxScaffoldOutput.indexOf("{")),
  ) as {directory?: string; language?: string};
  if (dlxScaffoldResult.directory !== dlxScaffold ||
      dlxScaffoldResult.language !== "python") {
    throw new Error("yarn dlx webhook scaffold output is invalid.");
  }
  if (JSON.stringify((await readdir(dlxScaffold)).sort()) !== JSON.stringify([
    ".env.example",
    ".gitignore",
    "README.md",
    "requirements.txt",
    "server.py",
  ])) {
    throw new Error("The packed Python webhook starter file set is incomplete.");
  }
  process.stdout.write(
    "Workspace, project-local, packed, npx, and yarn dlx @microfeed/cli behavior match.\n",
  );
} finally {
  await rm(temporary, {force: true, recursive: true});
}
