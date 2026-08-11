import {
  themeManifestV1Schema,
  type ThemeBundleV1,
  type ThemeManifestV1,
} from "@/shared/themes/ThemeContract";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import CLASSIC_MANIFEST from "../../../themes/classic/microfeed-theme.json";
import CLASSIC_WEB_HEADER from "../../../themes/classic/web-header.mustache?raw";
import CLASSIC_WEB_BODY_END from "../../../themes/classic/web-body-end.mustache?raw";
import CLASSIC_WEB_BODY_START from "../../../themes/classic/web-body-start.mustache?raw";
import CLASSIC_RSS_STYLESHEET from "../../../themes/classic/rss-stylesheet.xsl?raw";
import CLASSIC_WEB_FEED from "../../../themes/classic/web-feed.mustache?raw";
import CLASSIC_WEB_ITEM from "../../../themes/classic/web-item.mustache?raw";

export const CLASSIC_THEME_ID = "bundled-classic-v1";

export const CLASSIC_THEME_BUNDLE: ThemeBundleV1 = {
  assets: [],
  rssStylesheet: CLASSIC_RSS_STYLESHEET,
  webBodyEnd: CLASSIC_WEB_BODY_END,
  webBodyStart: CLASSIC_WEB_BODY_START,
  webFeed: CLASSIC_WEB_FEED,
  webHeader: CLASSIC_WEB_HEADER,
  webItem: CLASSIC_WEB_ITEM,
};

export const CLASSIC_THEME_MANIFEST = themeManifestV1Schema.parse(
  CLASSIC_MANIFEST,
);

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
      ...CLASSIC_THEME_BUNDLE,
      ...legacy,
      assets: [],
    },
    manifest: {
      ...CLASSIC_THEME_MANIFEST,
      author: "Site owner",
      description: `Automatically migrated from the previous custom theme “${String(themeName)}”.`,
      license: "Unspecified",
      name: "Imported site theme",
      packageId: MIGRATED_LEGACY_THEME_PACKAGE_ID,
      version: MIGRATED_LEGACY_THEME_VERSION,
    },
  };
}
