import {afterEach, describe, expect, it, vi} from "vitest";

import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import {
  BUNDLED_DEFAULT_THEME_BUNDLE,
} from "@/server/themes/BundledThemes";
import type {
  StoredThemeVersion,
  ThemeBundleV1,
  ThemeManifestV1,
} from "@/shared/themes/ThemeContract";

const manifest: ThemeManifestV1 = {
  assets: [],
  author: "Tests",
  files: {
    rssStylesheet: "rss.xsl",
    webBodyEnd: "body-end.mustache",
    webBodyStart: "body-start.mustache",
    webFeed: "feed.mustache",
    webHeader: "header.mustache",
    webItem: "item.mustache",
  },
  formatVersion: 1,
  license: "MIT",
  microfeed: "*",
  name: "Installed",
  packageId: "test.installed",
  version: "1.0.0",
};
const bundle: ThemeBundleV1 = {
  assets: [],
  rssStylesheet: "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"></xsl:stylesheet>",
  webBodyEnd: "installed-end",
  webBodyStart: "installed-start",
  webFeed: "installed {{title}} {{_theme.package_id}}",
  webHeader: "installed-header",
  webItem: "installed {{items.0.title}} / {{item.title}}",
};

function stored(overrides: Partial<StoredThemeVersion> = {}): StoredThemeVersion {
  return {
    assetOwnerThemeId: null,
    bundle,
    checksumSha256: "a".repeat(64),
    createdAt: new Date(0).toISOString(),
    deletedAt: null,
    id: "installed-id",
    manifest,
    name: manifest.name,
    originThemeId: null,
    packageId: manifest.packageId,
    sourceCommit: null,
    sourceKind: "admin",
    sourcePath: null,
    sourceRef: null,
    sourceUrl: null,
    version: manifest.version,
    ...overrides,
  };
}

const feed = {
  items: [{id: "one", title: "Item one"}],
  title: "Feed title",
  version: "https://jsonfeed.org/version/1.1",
};
const settings = {
  customCode: {
    currentTheme: "custom",
    themes: {
      custom: {...bundle, webFeed: "legacy {{title}}"},
    },
    webHeader: "shared {{_theme.package_id}}",
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe("production theme selection", () => {
  it("renders current_year in every installed Mustache template", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
    const currentYearBundle: ThemeBundleV1 = {
      ...bundle,
      rssStylesheet: "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"><xsl:template match=\"/\">{{current_year}}</xsl:template></xsl:stylesheet>",
      webBodyEnd: "{{current_year}}",
      webBodyStart: "{{current_year}}",
      webFeed: "{{current_year}}",
      webHeader: "{{current_year}}",
      webItem: "{{current_year}}",
    };
    const theme = new Theme(feed, settings, null, stored({bundle: currentYearBundle}));

    expect(theme.getWebHeader().html).toBe("2027");
    expect(theme.getWebBodyStart().html).toBe("2027");
    expect(theme.getWebBodyEnd().html).toBe("2027");
    expect(theme.getWebFeed().html).toBe("2027");
    expect(theme.getWebItem({}).html).toBe("2027");
    expect(theme.getRssStylesheet().stylesheet).toContain(">2027<");
  });

  it("uses stored immutable asset keys after cross-environment snapshot restore", () => {
    expect(themeAssetBaseUrl(
      {DEPLOYMENT_ENVIRONMENT: "preview"},
      "https://preview.example.test/",
      "owner-id",
      [{
        contentType: "image/png",
        key: "production/themes/owner-id/assets/images/logo.png",
        path: "assets/images/logo.png",
        sha256: "a".repeat(64),
        size: 10,
      }],
    )).toBe(
      "https://preview.example.test/media/production/themes/owner-id/assets/",
    );
  });

  it("uses the R2 custom domain for stored immutable theme asset keys", () => {
    expect(themeAssetBaseUrl(
      {DEPLOYMENT_ENVIRONMENT: "production"},
      "https://www.example.test/",
      "owner-id",
      [{
        contentType: "image/png",
        key: "production/themes/owner-id/assets/images/logo.png",
        path: "assets/images/logo.png",
        sha256: "a".repeat(64),
        size: 10,
      }],
      "https://media-cdn.example.test/",
    )).toBe(
      "https://media-cdn.example.test/production/themes/owner-id/assets/",
    );
  });

  it("uses the R2 custom domain for the generated theme asset path", () => {
    expect(themeAssetBaseUrl(
      {DEPLOYMENT_ENVIRONMENT: "production"},
      "https://www.example.test/",
      "owner-id",
      [],
      "https://media-cdn.example.test/",
    )).toBe(
      "https://media-cdn.example.test/production/themes/owner-id/assets/",
    );
  });

  it("selects a valid active D1 theme", () => {
    const theme = new Theme(feed, settings, null, stored());
    expect(theme.getWebFeed().html).toBe("installed Feed title test.installed");
    expect(theme.getWebItem(feed.items[0]!).html).toBe(
      "installed Item one / Item one",
    );
  });

  it("keeps shared custom code wrapped around installed themes", () => {
    const shared = new Theme(feed, settings, "shared", stored());
    expect(shared.getWebHeader().html).toBe("shared test.installed");
  });

  it("does not select retained legacy theme data after migration", () => {
    const theme = new Theme(feed, settings);
    expect(theme.getWebFeedTmpl()).toBe(BUNDLED_DEFAULT_THEME_BUNDLE.webFeed);
    expect(theme.name()).toBe("default");
    expect(theme.supportsPagesAndSearch()).toBe(true);
  });

  it("falls back safely when the active row is malformed or incompatible", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const malformed = stored({bundle: {...bundle, webFeed: "{{#broken}}"}});
    expect(new Theme(feed, settings, null, malformed).getWebFeedTmpl()).toBe(
      BUNDLED_DEFAULT_THEME_BUNDLE.webFeed,
    );
    const incompatible = stored({
      manifest: {...manifest, microfeed: ">=99.0.0"},
    });
    expect(new Theme(feed, settings, null, incompatible).getWebFeedTmpl()).toBe(
      BUNDLED_DEFAULT_THEME_BUNDLE.webFeed,
    );
    expect(new Theme(feed, settings, "shared", incompatible).getWebHeader().html)
      .toBe("shared microfeed.default");
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
