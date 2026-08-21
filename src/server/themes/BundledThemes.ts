import {
  themeManifestV1Schema,
  themePreviewFixtureSchema,
  type ThemeBundleV1,
  type ThemeManifestV1,
  type ThemePreviewFixture,
} from "@/shared/themes/ThemeContract";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import DEFAULT_MANIFEST from "../../../themes/default/microfeed-theme.json";
import DEFAULT_PREVIEW_FIXTURE from "../../../themes/default/fixtures/editorial.json";
import DEFAULT_WEB_HEADER from "../../../themes/default/web-header.mustache?raw";
import DEFAULT_WEB_BODY_END from "../../../themes/default/web-body-end.mustache?raw";
import DEFAULT_WEB_BODY_START from "../../../themes/default/web-body-start.mustache?raw";
import DEFAULT_RSS_STYLESHEET from "../../../themes/default/rss-stylesheet.xsl?raw";
import DEFAULT_WEB_FEED from "../../../themes/default/web-feed.mustache?raw";
import DEFAULT_WEB_ITEM from "../../../themes/default/web-item.mustache?raw";
import DEFAULT_WEB_PAGE from "../../../themes/default/web-page.mustache?raw";
import DEFAULT_WEB_SEARCH from "../../../themes/default/web-search.mustache?raw";

export const BUNDLED_DEFAULT_THEME_ID = "bundled-default-v2";

export const BUNDLED_DEFAULT_THEME_BUNDLE: ThemeBundleV1 = {
  assets: [],
  rssStylesheet: DEFAULT_RSS_STYLESHEET,
  webBodyEnd: DEFAULT_WEB_BODY_END,
  webBodyStart: DEFAULT_WEB_BODY_START,
  webFeed: DEFAULT_WEB_FEED,
  webHeader: DEFAULT_WEB_HEADER,
  webItem: DEFAULT_WEB_ITEM,
  webPage: DEFAULT_WEB_PAGE,
  webSearch: DEFAULT_WEB_SEARCH,
};

export const BUNDLED_DEFAULT_THEME_MANIFEST = themeManifestV1Schema.parse(
  DEFAULT_MANIFEST,
);

export const BUNDLED_DEFAULT_THEME_PREVIEW_FIXTURE: ThemePreviewFixture =
  themePreviewFixtureSchema.parse(DEFAULT_PREVIEW_FIXTURE);

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
      rssStylesheet: BUNDLED_DEFAULT_THEME_BUNDLE.rssStylesheet,
      webBodyEnd: BUNDLED_DEFAULT_THEME_BUNDLE.webBodyEnd,
      webBodyStart: BUNDLED_DEFAULT_THEME_BUNDLE.webBodyStart,
      webFeed: BUNDLED_DEFAULT_THEME_BUNDLE.webFeed,
      webHeader: BUNDLED_DEFAULT_THEME_BUNDLE.webHeader,
      webItem: BUNDLED_DEFAULT_THEME_BUNDLE.webItem,
      ...legacy,
      assets: [],
    },
    manifest: themeManifestV1Schema.parse({
      ...BUNDLED_DEFAULT_THEME_MANIFEST,
      assets: [],
      author: "Site owner",
      description: `Automatically migrated from the previous custom theme “${String(themeName)}”.`,
      files: {
        rssStylesheet: BUNDLED_DEFAULT_THEME_MANIFEST.files.rssStylesheet,
        webBodyEnd: BUNDLED_DEFAULT_THEME_MANIFEST.files.webBodyEnd,
        webBodyStart: BUNDLED_DEFAULT_THEME_MANIFEST.files.webBodyStart,
        webFeed: BUNDLED_DEFAULT_THEME_MANIFEST.files.webFeed,
        webHeader: BUNDLED_DEFAULT_THEME_MANIFEST.files.webHeader,
        webItem: BUNDLED_DEFAULT_THEME_MANIFEST.files.webItem,
      },
      formatVersion: 1,
      license: "Unspecified",
      name: "Imported site theme",
      packageId: MIGRATED_LEGACY_THEME_PACKAGE_ID,
      previewFixture: undefined,
      version: MIGRATED_LEGACY_THEME_VERSION,
    }),
  };
}
