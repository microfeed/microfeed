import {MICROFEED_VERSION} from "@/shared/Version";
import type {
  ThemeBundleV1,
  ThemeManifestV1,
} from "@/shared/themes/ThemeContract";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import DEFAULT_WEB_HEADER from "./defaults/web_header.html?raw";
import DEFAULT_WEB_BODY_END from "./defaults/web_body_end.html?raw";
import DEFAULT_WEB_BODY_START from "./defaults/web_body_start.html?raw";
import DEFAULT_RSS_STYLESHEET from "./defaults/rss_stylesheet.html?raw";
import DEFAULT_WEB_FEED from "./defaults/web_feed.html?raw";
import DEFAULT_WEB_ITEM from "./defaults/web_item.html?raw";

export const BUILT_IN_THEME_BUNDLE: ThemeBundleV1 = {
  assets: [],
  rssStylesheet: DEFAULT_RSS_STYLESHEET,
  webBodyEnd: DEFAULT_WEB_BODY_END,
  webBodyStart: DEFAULT_WEB_BODY_START,
  webFeed: DEFAULT_WEB_FEED,
  webHeader: DEFAULT_WEB_HEADER,
  webItem: DEFAULT_WEB_ITEM,
};

export const BUILT_IN_THEME_MANIFEST: ThemeManifestV1 = {
  assets: [],
  author: "microfeed",
  files: {
    rssStylesheet: "rss-stylesheet.xsl",
    webBodyEnd: "web-body-end.mustache",
    webBodyStart: "web-body-start.mustache",
    webFeed: "web-feed.mustache",
    webHeader: "web-header.mustache",
    webItem: "web-item.mustache",
  },
  formatVersion: 1,
  license: "AGPL-3.0",
  microfeed: `^${MICROFEED_VERSION}`,
  name: "microfeed default",
  packageId: "microfeed.default",
  version: MICROFEED_VERSION,
};

export const MIGRATED_LEGACY_THEME_ID = "legacy-theme-v1";
export const MIGRATED_LEGACY_THEME_PACKAGE_ID = "local.legacy-theme";
export const MIGRATED_LEGACY_THEME_VERSION = "1.0.0";

export function legacyThemeMigrationSource(
  settings: Record<string, any> | null | undefined,
): {bundle: ThemeBundleV1; manifest: ThemeManifestV1} | null {
  const customCode = settings?.[SETTINGS_CATEGORIES.CUSTOM_CODE];
  const themeName = customCode?.currentTheme;
  const legacy = themeName && customCode?.themes?.[themeName];
  if (!legacy) return null;
  return {
    bundle: {
      ...BUILT_IN_THEME_BUNDLE,
      ...legacy,
      assets: [],
    },
    manifest: {
      ...BUILT_IN_THEME_MANIFEST,
      author: "Site owner",
      description: `Automatically migrated from the legacy custom theme “${String(themeName)}”.`,
      license: "Unspecified",
      microfeed: "*",
      name: "Legacy theme",
      packageId: MIGRATED_LEGACY_THEME_PACKAGE_ID,
      version: MIGRATED_LEGACY_THEME_VERSION,
    },
  };
}
