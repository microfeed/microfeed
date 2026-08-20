import {describe, expect, it} from "vitest";

import {
  canonicalThemePackage,
  renderThemeSlot,
  themeContext,
} from "@/shared/themes/ThemeRenderer";
import type {
  ThemeBundleV1,
  ThemeManifestV1,
} from "@/shared/themes/ThemeContract";
import {
  assertUserThemePackageId,
  isReservedThemePackageId,
} from "@/shared/themes/ThemeContract";
import {
  ThemeValidationError,
  validateThemePackage,
} from "@/shared/themes/ThemeValidation";
import {
  manifestSearchItemDestination,
  resolveThemeSearchItemUrl,
} from "@/shared/themes/ThemeSearch";

function manifest(): ThemeManifestV1 {
  return {
    assets: [],
    author: "Theme author",
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
    microfeed: ">=1.0.0 <2.0.0",
    name: "Test theme",
    packageId: "test.theme",
    version: "1.2.3",
  };
}

function bundle(): ThemeBundleV1 {
  return {
    assets: [],
    rssStylesheet: "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"></xsl:stylesheet>",
    webBodyEnd: "</footer>",
    webBodyStart: "<header>{{title}}</header>",
    webFeed: "{{#items}}<article>{{title}}</article>{{/items}}",
    webHeader: "<title>{{title}}</title>",
    webItem: "{{#items.0}}<h1>{{title}}</h1>{{/items.0}}",
  };
}

function v2Package(searchItemDestination?: "attachment" | "url" | "web") {
  const sourceManifest = manifest();
  return {
    bundle: {
      ...bundle(),
      webPage: "<main>{{page.title}}</main>",
      webSearch: "<main>{{#search.results}}{{title}}{{/search.results}}</main>",
    },
    manifest: {
      ...sourceManifest,
      files: {
        ...sourceManifest.files,
        webPage: "page.mustache",
        webSearch: "search.mustache",
      },
      formatVersion: 2 as const,
      ...(searchItemDestination ? {searchItemDestination} : {}),
    },
  };
}

describe("theme contract", () => {
  it("reserves microfeed package IDs for bundled themes", () => {
    expect(isReservedThemePackageId("microfeed.default")).toBe(true);
    expect(isReservedThemePackageId("microfeed.future-theme")).toBe(true);
    expect(isReservedThemePackageId("local.microfeed.default")).toBe(false);
    expect(isReservedThemePackageId("example.theme")).toBe(false);
    expect(() => assertUserThemePackageId("microfeed.default"))
      .toThrow("reserved for bundled microfeed themes");
    expect(() => assertUserThemePackageId("local.microfeed.default"))
      .not.toThrow();
  });

  it("validates immutable SemVer packages against the running release", () => {
    expect(validateThemePackage(manifest(), bundle(), "1.0.1")).toEqual({
      bundle: bundle(),
      manifest: manifest(),
    });
    expect(() => validateThemePackage(
      {...manifest(), version: "next"},
      bundle(),
      "1.0.1",
    )).toThrow(ThemeValidationError);
    expect(() => validateThemePackage(
      {...manifest(), microfeed: ">=2.0.0"},
      bundle(),
      "1.0.1",
    )).toThrow("does not include microfeed 1.0.1");
  });

  it("validates optional v2 search destinations and defaults omission to web", () => {
    for (const destination of ["web", "url", "attachment"] as const) {
      const source = v2Package(destination);
      expect(validateThemePackage(source.manifest, source.bundle).manifest)
        .toMatchObject({searchItemDestination: destination});
      expect(manifestSearchItemDestination(source.manifest)).toBe(destination);
    }
    const omitted = v2Package();
    expect(validateThemePackage(omitted.manifest, omitted.bundle).manifest)
      .not.toHaveProperty("searchItemDestination");
    expect(manifestSearchItemDestination(omitted.manifest)).toBe("web");
    expect(manifestSearchItemDestination(manifest())).toBe("web");
    expect(() => validateThemePackage(
      {...omitted.manifest, searchItemDestination: "external" as never},
      omitted.bundle,
    )).toThrow(ThemeValidationError);
  });

  it("resolves item search destinations with local-page fallbacks", () => {
    const urls = {
      attachmentUrl: "https://example.test/media/episode.mp3",
      itemUrl: "https://publisher.example/episode",
      webUrl: "https://example.test/i/episode/",
    };
    expect(resolveThemeSearchItemUrl("web", urls)).toBe(urls.webUrl);
    expect(resolveThemeSearchItemUrl("url", urls)).toBe(urls.itemUrl);
    expect(resolveThemeSearchItemUrl("attachment", urls))
      .toBe(urls.attachmentUrl);
    expect(resolveThemeSearchItemUrl("url", {
      webUrl: urls.webUrl,
    })).toBe(urls.webUrl);
    expect(resolveThemeSearchItemUrl("attachment", {
      webUrl: urls.webUrl,
    })).toBe(urls.webUrl);
  });

  it("rejects traversal, malformed Mustache, and mismatched asset declarations", () => {
    expect(() => validateThemePackage(
      {...manifest(), files: {...manifest().files, webFeed: "../feed.mustache"}},
      bundle(),
    )).toThrow("Path traversal");
    expect(() => validateThemePackage(
      manifest(),
      {...bundle(), webFeed: "{{#items}}"},
    )).toThrow("Invalid Mustache syntax");
    expect(() => validateThemePackage(
      manifest(),
      {...bundle(), rssStylesheet: "<xsl:stylesheet>"},
    )).toThrow("Invalid XSL/XML: Unclosed tag 'xsl:stylesheet'.");
    expect(() => validateThemePackage(
      {...manifest(), assets: ["assets/logo.svg"]},
      bundle(),
    )).toThrow("missing from the bundle");
    const declaredAsset = {
      contentType: "image/svg+xml",
      key: "assets/logo.svg",
      path: "assets/logo.svg",
      sha256: "a".repeat(64),
      size: 1,
    };
    expect(() => validateThemePackage(
      {...manifest(), assets: ["assets/logo.svg", "assets/logo.svg"]},
      {...bundle(), assets: [declaredAsset, declaredAsset]},
    )).toThrow("must be unique");
    expect(() => validateThemePackage(
      {...manifest(), assets: [manifest().files.webFeed]},
      {...bundle(), assets: [{...declaredAsset, key: "feed.mustache", path: "feed.mustache"}]},
    )).toThrow("cannot also be one of the six template files");
    expect(() => validateThemePackage(
      manifest(),
      {...bundle(), webFeed: "x".repeat(128 * 1024 + 1)},
    )).toThrow("131072-byte limit");
  });

  it("injects theme metadata and preserves trusted unescaped rendering", () => {
    const context = themeContext({
      items: [{id: "one", title: "One"}],
      title: "Feed",
      version: "https://jsonfeed.org/version/1.1",
    }, {
      assetBaseUrl: "https://example.test/media/themes/one/assets/",
      packageId: "test.theme",
      version: "1.2.3",
    });
    expect(context._theme).toEqual({
      asset_base_url: "https://example.test/media/themes/one/assets/",
      package_id: "test.theme",
      version: "1.2.3",
    });
    expect(context.current_year).toBe(new Date().getUTCFullYear());
    expect(renderThemeSlot(
      {...bundle(), webFeed: "{{{items.0.content_html}}}"},
      "webFeed",
      {...context, items: [{content_html: "<script>trusted()</script>"}]},
    )).toBe("<script>trusted()</script>");
  });

  it("uses package asset content, not installation-specific R2 keys, in checksums", () => {
    const asset = {
      contentType: "image/png",
      path: "assets/logo.png",
      sha256: "a".repeat(64),
      size: 12,
    };
    const left = canonicalThemePackage(
      {...manifest(), assets: [asset.path]},
      {...bundle(), assets: [{...asset, key: "production/themes/one/assets/logo.png"}]},
    );
    const right = canonicalThemePackage(
      {...manifest(), assets: [asset.path]},
      {...bundle(), assets: [{...asset, key: "preview/themes/two/assets/logo.png"}]},
    );
    expect(left).toBe(right);
  });
});
