import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import {satisfies} from "semver";
import {x as extractTar} from "tar";

function run(command: string, args: string[], cwd = process.cwd()): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0"},
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

interface PackageMetadata {
  bin?: {"microfeed-theme"?: string; "theme-kit"?: string};
  bugs?: {url?: string};
  exports?: Record<string, {import?: string; types?: string}>;
  homepage?: string;
  keywords?: string[];
  name?: string;
  publishConfig?: {access?: string; registry?: string};
  repository?: {directory?: string; type?: string; url?: string};
  version?: string;
}

const temporary = await mkdtemp(path.join(tmpdir(), "microfeed-theme-kit-pack-"));
try {
  const rootPackage = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as {version: string};
  const archive = path.join(temporary, "microfeed-theme-kit.tgz");
  run("yarn", [
    "workspace",
    "@microfeed/theme-kit",
    "pack",
    "--out",
    archive,
  ]);
  await extractTar({cwd: temporary, file: archive});
  const packageDirectory = path.join(temporary, "package");
  const packedPackage = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  ) as PackageMetadata;

  if (packedPackage.name !== "@microfeed/theme-kit" ||
      packedPackage.version !== rootPackage.version ||
      packedPackage.bin?.["theme-kit"] !== "./dist/cli.js" ||
      packedPackage.bin?.["microfeed-theme"] !== "./dist/cli.js" ||
      packedPackage.exports?.["."]?.import !== "./dist/index.js" ||
      !packedPackage.exports?.["."]?.types?.endsWith("/index.d.ts")) {
    throw new Error(
      "The packed theme kit has stale version, executable, or library exports.",
    );
  }
  if (packedPackage.homepage !== "https://docs.microfeed.org/dashboard/themes/" ||
      packedPackage.bugs?.url !==
        "https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug" ||
      !packedPackage.keywords?.includes("theme") ||
      packedPackage.repository?.directory !== "packages/theme-kit" ||
      packedPackage.repository?.type !== "git" ||
      packedPackage.repository?.url !==
        "git+https://github.com/microfeed/microfeed.git" ||
      packedPackage.publishConfig?.access !== "public" ||
      packedPackage.publishConfig?.registry !== "https://registry.npmjs.org") {
    throw new Error("The packed theme kit is missing its npm discovery metadata.");
  }

  const [
    packedReadme,
    rootLicense,
    packedLicense,
    starterPackage,
    starterReadme,
    packedClaudeBridge,
    packedSkill,
  ] = await Promise.all([
      readFile(path.join(packageDirectory, "README.md"), "utf8"),
      readFile(path.join(process.cwd(), "LICENSE"), "utf8"),
      readFile(path.join(packageDirectory, "LICENSE"), "utf8"),
      readFile(path.join(packageDirectory, "assets/starter/package.json"), "utf8"),
      readFile(path.join(packageDirectory, "assets/starter/README.md"), "utf8"),
      readFile(path.join(packageDirectory, "assets/starter/CLAUDE.md"), "utf8"),
      readFile(path.join(
        packageDirectory,
        "assets/starter/.agents/skills/develop-microfeed-theme/SKILL.md",
      ), "utf8"),
    ]);
  if (!packedReadme.includes("Normal development workflow") ||
      !packedReadme.includes("npm install --global @microfeed/theme-kit") ||
      !packedReadme.includes("yarn manage theme install") ||
      !packedReadme.includes("immutable D1 theme row") ||
      !packedReadme.includes("immutable R2") ||
      !packedReadme.includes("Vite, Webpack, Tailwind CSS") ||
      !packedReadme.includes("GNU Affero General Public License v3.0")) {
    throw new Error("The packed theme-kit README is incomplete.");
  }
  if (packedLicense !== rootLicense) {
    throw new Error("The packed theme-kit license differs from the repository license.");
  }
  const parsedStarterPackage = JSON.parse(starterPackage) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  if (!satisfies(
    rootPackage.version,
    parsedStarterPackage.devDependencies?.["@microfeed/theme-kit"] ?? "",
  ) ||
      !parsedStarterPackage.scripts?.validate ||
      !parsedStarterPackage.scripts?.test ||
      !parsedStarterPackage.scripts?.preview ||
      !starterReadme.includes("generic standalone microfeed theme repository") ||
      !starterReadme.includes("yarn preview --feed-url https://example.com/json/") ||
      !packedClaudeBridge.includes(
        ".agents/skills/develop-microfeed-theme/SKILL.md",
      ) ||
      !packedSkill.includes("Never create screenshots unless the user explicitly asks")) {
    throw new Error("The packed generic theme scaffold is incomplete or stale.");
  }

  const consumer = path.join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({
    devDependencies: {"@microfeed/theme-kit": `file:${archive}`},
    packageManager: "yarn@4.18.0",
    private: true,
  }), "utf8");
  run("yarn", ["install"], consumer);
  const help = run("yarn", ["theme-kit", "--help"], consumer);
  if (!help.includes("theme-kit <command>") ||
      !help.includes("fixture pull <url>") ||
      !help.includes("--version")) {
    throw new Error("The project-local packed theme-kit help is incomplete.");
  }
  const version = run("yarn", ["theme-kit", "--version"], consumer);
  if (version.trim() !== rootPackage.version) {
    throw new Error("The project-local theme-kit executable reports a stale version.");
  }
  const validateHelp = run(
    "yarn",
    ["theme-kit", "validate", "--help"],
    consumer,
  );
  if (!validateHelp.includes("Validate the manifest") ||
      !validateHelp.includes("[--json]")) {
    throw new Error("The packed validate command help is incomplete.");
  }
  const installedStarter = path.join(packageDirectory, "assets/starter");
  const validation = JSON.parse(run(
    "yarn",
    ["theme-kit", "validate", installedStarter, "--json"],
    consumer,
  )) as {ok?: boolean; packageId?: string};
  if (!validation.ok || validation.packageId !== "example.my-theme") {
    throw new Error("The packed generic starter does not validate.");
  }
  const conformance = JSON.parse(run(
    "yarn",
    ["theme-kit", "test", installedStarter, "--json"],
    consumer,
  )) as {ok?: boolean; tests?: unknown[]};
  if (!conformance.ok || !conformance.tests || conformance.tests.length < 8) {
    throw new Error("The packed generic starter does not pass conformance tests.");
  }
  run("yarn", [
    "node",
    "--input-type=module",
    "-e",
    "import('@microfeed/theme-kit').then((kit)=>{if(!kit.themeManifestV1Schema||!kit.renderThemeTemplate||!kit.validateThemePackage)process.exit(1)})",
  ], consumer);

  const initializedTheme = path.join(temporary, "initialized-theme");
  run(
    "yarn",
    ["theme-kit", "init", initializedTheme],
    consumer,
  );
  const initializedPackage = JSON.parse(
    await readFile(path.join(initializedTheme, "package.json"), "utf8"),
  ) as {devDependencies?: Record<string, string>};
  if (!satisfies(
    rootPackage.version,
    initializedPackage.devDependencies?.["@microfeed/theme-kit"] ?? "",
  )) {
    throw new Error("The packed init command generated a stale local dependency.");
  }
  const initializedClaudeBridge = await readFile(
    path.join(initializedTheme, "CLAUDE.md"),
    "utf8",
  );
  if (!initializedClaudeBridge.includes(
    ".agents/skills/develop-microfeed-theme/SKILL.md",
  )) {
    throw new Error("The packed init command omitted its Claude Code bridge.");
  }

  const dlxHelp = run("yarn", [
    "dlx",
    "--package",
    `@microfeed/theme-kit@file:${archive}`,
    "theme-kit",
    "--help",
  ], temporary);
  if (!dlxHelp.endsWith(help)) {
    throw new Error("The yarn dlx @microfeed/theme-kit behavior diverged.");
  }
  const compatibilityVersion = run(
    "yarn",
    ["microfeed-theme", "--version"],
    consumer,
  );
  if (compatibilityVersion.trim() !== rootPackage.version) {
    throw new Error("The compatibility theme-kit executable reports a stale version.");
  }
  process.stdout.write(
    "Workspace, packed, project-local, library, scaffold, and yarn dlx theme-kit behavior match.\n",
  );
} finally {
  await rm(temporary, {force: true, recursive: true});
}
