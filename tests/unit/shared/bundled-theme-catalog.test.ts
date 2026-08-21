import {describe, expect, it} from "vitest";

import {
  BUNDLED_FALLBACK_THEME,
  BUNDLED_THEME_CATALOG,
  bundledThemeCatalogEntryByKey,
  bundledThemeCatalogEntryByPackageId,
  bundledThemeCatalogEntryBySource,
  canonicalBundledThemeSource,
} from "@/shared/themes/BundledThemeCatalog";

describe("Built-in theme catalog", () => {
  it("has unique ordered identities and exactly one fallback", () => {
    expect(BUNDLED_THEME_CATALOG.map(({key}) => key)).toEqual([
      "default",
      "podcast",
      "blog",
      "photo",
    ]);
    expect(new Set(BUNDLED_THEME_CATALOG.map(({key}) => key)).size)
      .toBe(BUNDLED_THEME_CATALOG.length);
    expect(new Set(BUNDLED_THEME_CATALOG.map(({directory}) => directory)).size)
      .toBe(BUNDLED_THEME_CATALOG.length);
    expect(new Set(
      BUNDLED_THEME_CATALOG.map(({packageId}) => packageId),
    ).size).toBe(BUNDLED_THEME_CATALOG.length);
    expect(BUNDLED_THEME_CATALOG.map(({order}) => order)).toEqual([
      0,
      1,
      2,
      3,
    ]);
    expect(BUNDLED_THEME_CATALOG.filter(({fallback}) => fallback))
      .toEqual([BUNDLED_FALLBACK_THEME]);
    expect(BUNDLED_FALLBACK_THEME.manifest.packageId)
      .toBe("microfeed.default");
  });

  it("resolves canonical sources and the legacy Default alias", () => {
    const entry = BUNDLED_THEME_CATALOG[0]!;
    expect(bundledThemeCatalogEntryByKey(entry.key)).toBe(entry);
    expect(bundledThemeCatalogEntryByPackageId(entry.manifest.packageId))
      .toBe(entry);
    expect(bundledThemeCatalogEntryBySource("bundled:default")).toBe(entry);
    expect(bundledThemeCatalogEntryBySource("default")).toBe(entry);
    expect(bundledThemeCatalogEntryBySource("bundled:missing")).toBeNull();
    expect(canonicalBundledThemeSource(entry.manifest.packageId))
      .toBe("bundled:default");
    expect(bundledThemeCatalogEntryBySource("bundled:podcast")?.packageId)
      .toBe("microfeed.podcast");
  });
});
