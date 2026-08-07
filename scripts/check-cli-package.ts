import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import {x as extractTar} from "tar";
import {CLI_HELP_TOPICS, renderCliHelp} from "../packages/cli/src/help";
import {HELP} from "../packages/cli/src/index";

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

const temporary = await mkdtemp(path.join(tmpdir(), "microfeed-cli-pack-"));
try {
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
  ) as {bin?: {microfeed?: string}; name?: string};
  if (packedPackage.name !== "@microfeed/cli" ||
      packedPackage.bin?.microfeed !== "dist/index.js") {
    throw new Error("The packed CLI does not expose the microfeed binary.");
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
  process.stdout.write(
    "Workspace, project-local, packed, and yarn dlx @microfeed/cli behavior match.\n",
  );
} finally {
  await rm(temporary, {force: true, recursive: true});
}
