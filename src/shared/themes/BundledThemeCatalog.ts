import DEFAULT_MANIFEST from "../../../themes/default/microfeed-theme.json";

import {
  themeManifestV1Schema,
  type ThemeManifestV1,
} from "./ThemeContract";

export const BUNDLED_THEME_SOURCE_PREFIX = "bundled:";

export interface BundledThemeCatalogEntry {
  directory: string;
  fallback: boolean;
  key: string;
  manifest: ThemeManifestV1;
  order: number;
  packageId: string;
  source: string;
}

function catalogEntry(
  key: string,
  directory: string,
  order: number,
  fallback: boolean,
  manifest: unknown,
): BundledThemeCatalogEntry {
  const parsedManifest = themeManifestV1Schema.parse(manifest);
  return {
    directory,
    fallback,
    key,
    manifest: parsedManifest,
    order,
    packageId: parsedManifest.packageId,
    source: `${BUNDLED_THEME_SOURCE_PREFIX}${key}`,
  };
}

export const BUNDLED_THEME_CATALOG: readonly BundledThemeCatalogEntry[] = [
  catalogEntry("default", "default", 0, true, DEFAULT_MANIFEST),
];

function assertValidCatalog(
  catalog: readonly BundledThemeCatalogEntry[],
): void {
  const assertUnique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) {
      throw new Error(`Built-in theme catalog ${label} must be unique.`);
    }
  };
  assertUnique(catalog.map(({key}) => key), "keys");
  assertUnique(catalog.map(({directory}) => directory), "directories");
  assertUnique(catalog.map(({packageId}) => packageId), "package IDs");
  assertUnique(catalog.map(({order}) => String(order)), "orders");
  if (catalog.some(({order}, index) => order !== index)) {
    throw new Error("Built-in theme catalog order must be contiguous.");
  }
  if (catalog.filter(({fallback}) => fallback).length !== 1) {
    throw new Error("Built-in theme catalog must declare exactly one fallback.");
  }
}

assertValidCatalog(BUNDLED_THEME_CATALOG);

export const BUNDLED_FALLBACK_THEME = BUNDLED_THEME_CATALOG.find(
  ({fallback}) => fallback,
) as BundledThemeCatalogEntry;

export function bundledThemeCatalogEntryByKey(
  key: string,
): BundledThemeCatalogEntry | null {
  return BUNDLED_THEME_CATALOG.find((entry) => entry.key === key) ?? null;
}

export function bundledThemeCatalogEntryByPackageId(
  packageId: string,
): BundledThemeCatalogEntry | null {
  return BUNDLED_THEME_CATALOG.find(
    (entry) => entry.packageId === packageId,
  ) ?? null;
}

export function bundledThemeCatalogEntryBySource(
  source: string,
): BundledThemeCatalogEntry | null {
  const normalized = source === "default"
    ? `${BUNDLED_THEME_SOURCE_PREFIX}default`
    : source;
  if (!normalized.startsWith(BUNDLED_THEME_SOURCE_PREFIX)) return null;
  return bundledThemeCatalogEntryByKey(
    normalized.slice(BUNDLED_THEME_SOURCE_PREFIX.length),
  );
}

export function canonicalBundledThemeSource(
  packageId: string,
): string | null {
  return bundledThemeCatalogEntryByPackageId(packageId)?.source ?? null;
}
