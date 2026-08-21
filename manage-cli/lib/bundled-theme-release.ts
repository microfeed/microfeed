import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {gt, valid} from "semver";
import * as z from "zod";

import {loadThemePackage} from "../../packages/theme-kit/src/package";
import {
  canonicalThemePackage,
  sha256Hex,
} from "../../src/shared/themes/ThemeRenderer";
import {
  BUNDLED_THEME_CATALOG,
  bundledThemeCatalogEntryByKey,
  type BundledThemeCatalogEntry,
} from "../../src/shared/themes/BundledThemeCatalog";

const releasedThemeSchema = z.object({
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  version: z.string().refine((value) => valid(value) === value, {
    message: "Use an exact semantic version.",
  }),
}).strict();

const bundledThemeReleasesSchema = z.object({
  packageId: z.string().min(1),
  releases: z.array(releasedThemeSchema).min(1),
}).strict();

export interface BundledThemeReleaseIdentity {
  checksumSha256: string;
  packageId: string;
  version: string;
}

interface BundledThemeReleaseRegistry {
  packageId: string;
  releases: Array<{
    checksumSha256: string;
    version: string;
  }>;
}

function catalogEntry(key: string): BundledThemeCatalogEntry {
  const entry = bundledThemeCatalogEntryByKey(key);
  if (!entry) throw new Error(`Unknown Built-in theme key: ${key}`);
  return entry;
}

function releaseRegistryFilename(
  repositoryRoot: string,
  entry: BundledThemeCatalogEntry,
): string {
  return path.join(
    repositoryRoot,
    "themes",
    entry.directory,
    "released-packages.json",
  );
}

async function releaseRegistry(
  repositoryRoot: string,
  entry: BundledThemeCatalogEntry,
): Promise<BundledThemeReleaseRegistry> {
  const filename = releaseRegistryFilename(repositoryRoot, entry);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to read the bundled theme release registry at ${filename}.`,
      {cause: error},
    );
  }
  const registry = bundledThemeReleasesSchema.parse(parsed);
  const versions = new Set<string>();
  let previous: string | null = null;
  for (const release of registry.releases) {
    if (versions.has(release.version)) {
      throw new Error(
        `The bundled theme release registry repeats version ${release.version}.`,
      );
    }
    if (previous && !gt(release.version, previous)) {
      throw new Error(
        "Bundled theme releases must be listed in ascending SemVer order.",
      );
    }
    versions.add(release.version);
    previous = release.version;
  }
  return registry;
}

export async function currentBundledThemeRelease(
  repositoryRoot: string,
  key = "default",
): Promise<BundledThemeReleaseIdentity> {
  const entry = catalogEntry(key);
  const loaded = await loadThemePackage(
    path.join(repositoryRoot, "themes", entry.directory),
  );
  return {
    checksumSha256: await sha256Hex(
      canonicalThemePackage(
        loaded.manifest,
        loaded.bundle,
        loaded.previewFixture,
      ),
    ),
    packageId: loaded.manifest.packageId,
    version: loaded.manifest.version,
  };
}

function releasedIdentity(
  registry: BundledThemeReleaseRegistry,
  current: BundledThemeReleaseIdentity,
): BundledThemeReleaseIdentity {
  if (registry.packageId !== current.packageId) {
    throw new Error(
      `The bundled theme release registry belongs to ${registry.packageId}, ` +
        `not ${current.packageId}.`,
    );
  }
  const released = registry.releases.find(({version}) =>
    version === current.version
  );
  if (!released) {
    throw new Error(
      `${current.packageId}@${current.version} is not recorded as an ` +
        "immutable bundled theme release. Run `yarn theme:release` after " +
        "choosing a new version.",
    );
  }
  if (released.checksumSha256 !== current.checksumSha256) {
    throw new Error(
      `${current.packageId}@${current.version} was already released with ` +
        `checksum ${released.checksumSha256}, but the current package has ` +
        `${current.checksumSha256}. Increment the theme version, then run ` +
        "`yarn theme:release`. Never replace an existing release checksum.",
    );
  }
  return current;
}

export async function verifyBundledThemeRelease(
  repositoryRoot: string,
  key = "default",
): Promise<BundledThemeReleaseIdentity> {
  const entry = catalogEntry(key);
  return releasedIdentity(
    await releaseRegistry(repositoryRoot, entry),
    await currentBundledThemeRelease(repositoryRoot, key),
  );
}

export async function recordBundledThemeRelease(
  repositoryRoot: string,
  key = "default",
): Promise<{identity: BundledThemeReleaseIdentity; recorded: boolean}> {
  const entry = catalogEntry(key);
  const [registry, current] = await Promise.all([
    releaseRegistry(repositoryRoot, entry),
    currentBundledThemeRelease(repositoryRoot, key),
  ]);
  if (registry.packageId !== current.packageId) {
    releasedIdentity(registry, current);
  }
  const existing = registry.releases.find(({version}) =>
    version === current.version
  );
  if (existing) {
    return {
      identity: releasedIdentity(registry, current),
      recorded: false,
    };
  }
  const latest = registry.releases.at(-1)!;
  if (!gt(current.version, latest.version)) {
    throw new Error(
      `${current.version} must be newer than the latest bundled theme ` +
        `release, ${latest.version}.`,
    );
  }
  registry.releases.push({
    checksumSha256: current.checksumSha256,
    version: current.version,
  });
  await writeFile(
    releaseRegistryFilename(repositoryRoot, entry),
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
  return {identity: current, recorded: true};
}

export async function verifyBundledThemeReleases(
  repositoryRoot: string,
): Promise<BundledThemeReleaseIdentity[]> {
  return Promise.all(BUNDLED_THEME_CATALOG.map(({key}) =>
    verifyBundledThemeRelease(repositoryRoot, key)
  ));
}

export async function recordBundledThemeReleases(
  repositoryRoot: string,
): Promise<Array<{identity: BundledThemeReleaseIdentity; recorded: boolean}>> {
  return Promise.all(BUNDLED_THEME_CATALOG.map(({key}) =>
    recordBundledThemeRelease(repositoryRoot, key)
  ));
}
