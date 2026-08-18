import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {gt, valid} from "semver";
import * as z from "zod";

import {loadThemePackage} from "../../packages/theme-kit/src/package";
import {
  canonicalThemePackage,
  sha256Hex,
} from "../../src/shared/themes/ThemeRenderer";

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

function releaseRegistryFilename(repositoryRoot: string): string {
  return path.join(
    repositoryRoot,
    "themes/default/released-packages.json",
  );
}

async function releaseRegistry(
  repositoryRoot: string,
): Promise<BundledThemeReleaseRegistry> {
  const filename = releaseRegistryFilename(repositoryRoot);
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
): Promise<BundledThemeReleaseIdentity> {
  const loaded = await loadThemePackage(
    path.join(repositoryRoot, "themes/default"),
  );
  return {
    checksumSha256: await sha256Hex(
      canonicalThemePackage(loaded.manifest, loaded.bundle),
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
): Promise<BundledThemeReleaseIdentity> {
  return releasedIdentity(
    await releaseRegistry(repositoryRoot),
    await currentBundledThemeRelease(repositoryRoot),
  );
}

export async function recordBundledThemeRelease(
  repositoryRoot: string,
): Promise<{identity: BundledThemeReleaseIdentity; recorded: boolean}> {
  const [registry, current] = await Promise.all([
    releaseRegistry(repositoryRoot),
    currentBundledThemeRelease(repositoryRoot),
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
    releaseRegistryFilename(repositoryRoot),
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
  return {identity: current, recorded: true};
}
