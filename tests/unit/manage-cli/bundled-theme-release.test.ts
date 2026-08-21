import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {inc} from "semver";
import {afterEach, describe, expect, it} from "vitest";

import {BUNDLED_THEME_CATALOG} from "@/shared/themes/BundledThemeCatalog";
import {
  recordBundledThemeRelease,
  recordBundledThemeReleases,
  verifyBundledThemeRelease,
  verifyBundledThemeReleases,
} from "../../../manage-cli/lib/bundled-theme-release";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const temporaryRepositories: string[] = [];

async function temporaryRepository(): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "microfeed-theme-release-test-"),
  );
  temporaryRepositories.push(directory);
  await mkdir(path.join(directory, "themes"), {recursive: true});
  await Promise.all(BUNDLED_THEME_CATALOG.map(({directory: themeDirectory}) =>
    cp(
      path.join(repositoryRoot, "themes", themeDirectory),
      path.join(directory, "themes", themeDirectory),
      {recursive: true},
    )
  ));
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryRepositories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("bundled theme release registry", () => {
  it("matches the exact current immutable package", async () => {
    await expect(verifyBundledThemeRelease(repositoryRoot)).resolves
      .toMatchObject({packageId: "microfeed.default"});
  });

  it("verifies and records every catalog ledger", async () => {
    await expect(verifyBundledThemeReleases(repositoryRoot)).resolves
      .toEqual([expect.objectContaining({packageId: "microfeed.default"})]);
    await expect(recordBundledThemeReleases(repositoryRoot)).resolves
      .toEqual([expect.objectContaining({recorded: false})]);
  });

  it("rejects changed package bytes under a released version", async () => {
    const directory = await temporaryRepository();
    await appendFile(
      path.join(directory, "themes/default/web-feed.mustache"),
      "\nchanged after release\n",
      "utf8",
    );

    await expect(verifyBundledThemeRelease(directory)).rejects.toThrow(
      /was already released with checksum/u,
    );
    await expect(recordBundledThemeRelease(directory)).rejects.toThrow(
      /Never replace an existing release checksum/u,
    );
  });

  it("records only a newer package version and then verifies it", async () => {
    const directory = await temporaryRepository();
    const manifestFilename = path.join(
      directory,
      "themes/default/microfeed-theme.json",
    );
    const manifest = JSON.parse(
      await readFile(manifestFilename, "utf8"),
    ) as {version: string};
    const nextVersion = inc(manifest.version, "patch");
    if (!nextVersion) throw new Error("Expected a valid bundled theme version.");
    manifest.version = nextVersion;
    await writeFile(
      manifestFilename,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    await appendFile(
      path.join(directory, "themes/default/web-feed.mustache"),
      "\nnew release\n",
      "utf8",
    );

    await expect(recordBundledThemeRelease(directory)).resolves.toMatchObject({
      identity: {version: nextVersion},
      recorded: true,
    });
    await expect(verifyBundledThemeRelease(directory)).resolves.toMatchObject({
      version: nextVersion,
    });
    await expect(recordBundledThemeRelease(directory)).resolves.toMatchObject({
      recorded: false,
    });
  });
});
