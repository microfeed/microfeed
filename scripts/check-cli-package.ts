import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import {x as extractTar} from "tar";
import {CLI_HELP_TOPICS, renderCliHelp} from "../packages/cli/src/help";
import {HELP} from "../packages/cli/src/index";

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

const temporary = await mkdtemp(path.join(tmpdir(), "microfeed-cli-pack-"));
try {
  const rootPackage = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as {version: string};
  const archive = path.join(temporary, "microfeed-cli.tgz");
  run("yarn", [
    "workspace",
    "@microfeed/cli",
    "pack",
    "--out",
    archive,
  ]);
  await extractTar({cwd: temporary, file: archive});
  const packedPackage = JSON.parse(
    await readFile(path.join(temporary, "package", "package.json"), "utf8"),
  ) as {
    bin?: {microfeed?: string};
    bugs?: {url?: string};
    homepage?: string;
    keywords?: string[];
    name?: string;
    publishConfig?: {access?: string; registry?: string};
    repository?: {directory?: string; type?: string; url?: string};
    version?: string;
  };
  if (packedPackage.name !== "@microfeed/cli" ||
      packedPackage.version !== rootPackage.version ||
      packedPackage.bin?.microfeed !== "dist/index.js") {
    throw new Error(
      "The packed CLI has a stale version or does not expose the microfeed binary.",
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
  const packedReadme = await readFile(
    path.join(temporary, "package", "README.md"),
    "utf8",
  );
  if (!packedReadme.includes("yarn microfeed login") ||
      !packedReadme.includes("npm install --global @microfeed/cli") ||
      !packedReadme.includes("npx @microfeed/cli manage") ||
      !packedReadme.includes("Site URLs and instance names") ||
      !packedReadme.includes("GNU Affero General Public License v3.0")) {
    throw new Error("The packed CLI README is incomplete.");
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
  run("yarn", ["install"], project);
  const projectHelp = run("yarn", ["microfeed", "--help"], project);
  if (HELP !== projectHelp) {
    throw new Error("A project-local @microfeed/cli behaves differently.");
  }
  const expectedCreateHelp = renderCliHelp(["item", "create"]);
  const projectCreateHelp = run(
    "yarn",
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
  const projectScaffoldResult = JSON.parse(run(
    "yarn",
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
  run("yarn", ["install"], projectScaffold);
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

  const dlxHelp = run("yarn", [
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
  const dlxManageHelp = run("yarn", [
    "dlx",
    "--package",
    `@microfeed/cli@file:${archive}`,
    "microfeed",
    "manage",
    "--help",
  ], temporary);
  if (!dlxManageHelp.endsWith(expectedManageHelp)) {
    throw new Error("The packed clone-free management help diverged.");
  }

  const npmConsumer = path.join(temporary, "npm-consumer");
  await mkdir(npmConsumer);
  await writeFile(path.join(npmConsumer, "package.json"), JSON.stringify({
    private: true,
  }));
  run("npm", [
    "install",
    "--ignore-scripts",
    "--omit=optional",
    archive,
  ], npmConsumer);
  const npxManageHelp = run("npx", [
    "--no-install",
    "microfeed",
    "manage",
    "--help",
  ], npmConsumer);
  if (npxManageHelp !== expectedManageHelp) {
    throw new Error("The npx @microfeed/cli management help diverged.");
  }

  if (process.platform !== "win32") {
    const cacheRoot = path.join(temporary, "launcher-cache");
    const manageCache = path.join(cacheRoot, "manage");
    const repository = path.join(manageCache, "repository");
    const cacheBin = path.join(manageCache, "bin");
    const fakeBin = path.join(temporary, "launcher-tools");
    await Promise.all([
      mkdir(repository, {recursive: true}),
      mkdir(cacheBin, {recursive: true}),
      mkdir(fakeBin, {recursive: true}),
    ]);
    await writeFile(
      path.join(repository, "package.json"),
      `${JSON.stringify({version: rootPackage.version})}\n`,
    );
    const fakeTool = async (name: string, source: string): Promise<void> => {
      const filename = path.join(fakeBin, name);
      await writeFile(filename, `#!/usr/bin/env node\n${source}\n`, {
        mode: 0o755,
      });
      await chmod(filename, 0o755);
    };
    await Promise.all([
      fakeTool("npm", "process.stdout.write('10.0.0\\n');"),
      fakeTool("corepack", "process.stdout.write('0.31.0\\n');"),
      fakeTool("git", [
        "const args = process.argv.slice(2);",
        "if (args[0] === '--version') process.stdout.write('git version 2.50.0\\n');",
        "else if (args.includes('rev-parse')) process.stdout.write('0123456789abcdef0123456789abcdef01234567\\n');",
        "else if (!args.includes('status')) process.exitCode = 1;",
      ].join("\n")),
    ]);
    const yarn = path.join(cacheBin, "yarn");
    await writeFile(yarn, "#!/usr/bin/env node\n", {mode: 0o755});
    await chmod(yarn, 0o755);
    const handoff = run("npx", [
      "--no-install",
      "microfeed",
      "manage",
    ], npmConsumer, {
      MICROFEED_CACHE_DIR: cacheRoot,
      MICROFEED_CONFIG_DIR: path.join(temporary, "launcher-config"),
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
    });
    if (!handoff.includes(`microfeed v${rootPackage.version}`) ||
        !handoff.includes("deploy-microfeed/SKILL.md") ||
        !handoff.includes("docs/manage-cli.md") ||
        !handoff.includes("npx @microfeed/cli manage accounts --json") ||
        !handoff.includes("final status check succeeds")) {
      throw new Error("The packed npx coding-agent handoff is incomplete.");
    }
  }
  const dlxScaffold = path.join(temporary, "dlx-scaffold");
  const dlxScaffoldOutput = run("yarn", [
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
