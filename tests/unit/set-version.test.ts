import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it} from "vitest";

import {
  setReleaseVersion,
  themeKitCompatibilityRange,
  validateReleaseVersion,
} from "../../scripts/set-version";

const temporaryDirectories: string[] = [];

async function writeJson(root: string, filename: string, value: unknown) {
  const fullPath = path.join(root, filename);
  await mkdir(path.dirname(fullPath), {recursive: true});
  await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(root: string, filename: string) {
  return JSON.parse(await readFile(path.join(root, filename), "utf8")) as {
    devDependencies?: Record<string, string>;
    version?: string;
  };
}

async function repositoryFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "microfeed-version-test-"));
  temporaryDirectories.push(root);
  await Promise.all([
    writeJson(root, "package.json", {name: "microfeed", version: "1.0.0"}),
    writeJson(root, "packages/cli/package.json", {
      name: "@microfeed/cli",
      version: "1.0.0",
    }),
    writeJson(root, "packages/theme-kit/package.json", {
      name: "@microfeed/theme-kit",
      version: "1.0.0",
    }),
    writeJson(root, "themes/default/microfeed-theme.json", {
      packageId: "microfeed.default",
      version: "1.0.0",
    }),
    writeJson(root, "packages/theme-kit/assets/starter/package.json", {
      devDependencies: {"@microfeed/theme-kit": "^1.0.0"},
      name: "microfeed-theme",
      version: "0.1.0",
    }),
  ]);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("release version synchronization", () => {
  it("updates published metadata without rewriting the bundled theme", async () => {
    const root = await repositoryFixture();

    await expect(setReleaseVersion(root, "2.3.4")).resolves.toEqual([
      "package.json",
      "packages/cli/package.json",
      "packages/theme-kit/package.json",
      "packages/theme-kit/assets/starter/package.json",
    ]);

    for (const filename of [
      "package.json",
      "packages/cli/package.json",
      "packages/theme-kit/package.json",
    ]) {
      await expect(readJson(root, filename)).resolves.toMatchObject({version: "2.3.4"});
    }
    await expect(readJson(root, "themes/default/microfeed-theme.json"))
      .resolves.toMatchObject({version: "1.0.0"});
    await expect(readJson(
      root,
      "packages/theme-kit/assets/starter/package.json",
    )).resolves.toMatchObject({
      devDependencies: {"@microfeed/theme-kit": "^2.0.0"},
      version: "0.1.0",
    });
  });

  it("rejects ambiguous or invalid versions before writing", async () => {
    expect(() => validateReleaseVersion("v1.2.3")).toThrow("exact semantic version");
    expect(() => validateReleaseVersion("1.2")).toThrow("exact semantic version");
    expect(() => validateReleaseVersion(" 1.2.3 ")).toThrow("exact semantic version");
    expect(validateReleaseVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1");
    expect(themeKitCompatibilityRange("1.2.3-beta.1"))
      .toBe(">=1.2.3-beta.1 <2.0.0");
    expect(themeKitCompatibilityRange("0.4.2")).toBe("^0.4.2");
  });

  it("verifies target identities before changing any file", async () => {
    const root = await repositoryFixture();
    await writeJson(root, "packages/cli/package.json", {
      name: "not-the-cli",
      version: "1.0.0",
    });

    await expect(setReleaseVersion(root, "1.0.1"))
      .rejects.toThrow("not the expected @microfeed/cli metadata file");
    await expect(readJson(root, "package.json"))
      .resolves.toMatchObject({version: "1.0.0"});
  });
});
