import {execFile} from "node:child_process";
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {afterEach, expect, it} from "vitest";

const run = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {recursive: true, force: true})));
});

it("packages current tracked sources while excluding unstaged deletions and untracked files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "microfeed-runtime-pack-"));
  temporaryDirectories.push(root);
  const scripts = path.join(root, "packages/cli/scripts");
  await mkdir(scripts, {recursive: true});
  await mkdir(path.join(root, "tests/unit"), {recursive: true});
  for (const filename of ["package.json", "packages/cli/package.json"]) {
    await writeFile(path.join(root, filename), JSON.stringify({version: "1.0.0"}));
  }
  await writeFile(path.join(root, "tests/unit/keep.test.ts"), "original");
  const deleted = path.join(root, "tests/unit/deleted.test.ts");
  await writeFile(deleted, "obsolete");
  await run("git", ["init", "--quiet"], {cwd: root});
  await run("git", ["add", "package.json", "packages/cli/package.json", "tests"], {cwd: root});
  await run("git", [
    "-c", "user.name=Runtime test", "-c", "user.email=runtime@example.test",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=hooks-disabled",
    "commit", "--quiet", "-m", "Fixture",
  ], {cwd: root});
  await rm(deleted);
  await writeFile(path.join(root, "tests/unit/keep.test.ts"), "updated");
  await writeFile(path.join(root, "tests/unit/untracked.test.ts"), "not packaged");
  const script = path.join(scripts, "copy-manage-runtime.mjs");
  await cp(new URL("../../../packages/cli/scripts/copy-manage-runtime.mjs", import.meta.url), script);
  await run(process.execPath, [script], {cwd: root});

  const manifest = JSON.parse(await readFile(
    path.join(root, "packages/cli/dist/manage-runtime-manifest.json"), "utf8",
  )) as {files: Array<{path: string; sha256: string}>};
  expect(manifest.files.map(file => file.path)).toEqual([
    "package.json", "packages/cli/package.json", "tests/unit/keep.test.ts",
  ]);
  const retained = manifest.files.find(file => file.path === "tests/unit/keep.test.ts")!;
  expect(await readFile(path.join(root, "packages/cli/dist/manage-runtime-files", retained.sha256), "utf8"))
    .toBe("updated");
});
