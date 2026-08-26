import {CODE_FILES, CODE_TYPES, SETTINGS_CATEGORIES} from "@/shared/Constants";
import type {
  StoredThemeVersion,
  ThemeBundleV1,
  ThemeFileKey,
  ThemeSearchItemDestination,
} from "@/shared/themes/ThemeContract";
import {
  renderThemeTemplate,
  themeContext,
  type ThemeRuntimeMetadata,
} from "@/shared/themes/ThemeRenderer";
import {validateStoredThemePackage} from "@/shared/themes/ThemeValidation";
import {MICROFEED_VERSION} from "@/shared/Version";
import {manifestSearchItemDestination} from "@/shared/themes/ThemeSearch";
import {
  BUNDLED_DEFAULT_THEME_BUNDLE,
  BUNDLED_DEFAULT_THEME_MANIFEST,
} from "./BundledThemes";

type Settings = Record<string, any> | null;

export function themeSupportsPagesAndSearch(
  installedTheme: StoredThemeVersion | null | undefined,
): boolean {
  if (!installedTheme) {
    return BUNDLED_DEFAULT_THEME_MANIFEST.formatVersion >= 2;
  }
  try {
    return validateStoredThemePackage(
      installedTheme.manifest,
      installedTheme.bundle,
      MICROFEED_VERSION,
    ).manifest.formatVersion >= 2;
  } catch {
    return BUNDLED_DEFAULT_THEME_MANIFEST.formatVersion >= 2;
  }
}

export function activeThemeSearchItemDestination(
  installedTheme: StoredThemeVersion | null | undefined,
): ThemeSearchItemDestination {
  const fallback = manifestSearchItemDestination(
    BUNDLED_DEFAULT_THEME_MANIFEST,
  );
  if (!installedTheme) return fallback;
  try {
    return manifestSearchItemDestination(validateStoredThemePackage(
      installedTheme.manifest,
      installedTheme.bundle,
      MICROFEED_VERSION,
    ).manifest);
  } catch {
    return fallback;
  }
}

export default class Theme {
  private readonly context: Record<string, unknown>;
  private readonly settings: Settings;
  private readonly theme: string;
  private readonly themeBundle: ThemeBundleV1 | Record<string, string> | null;
  private readonly formatVersion: number;

  constructor(
    jsonData: Record<string, unknown>,
    settings: Settings = null,
    themeName: string | null = null,
    installedTheme: StoredThemeVersion | null = null,
    assetBaseUrl = "",
    extraContext: Record<string, unknown> = {},
  ) {
    this.settings = settings;
    this.formatVersion = themeSupportsPagesAndSearch(installedTheme) ? 2 : 1;
    let metadata: ThemeRuntimeMetadata = {
      assetBaseUrl: "",
      packageId: BUNDLED_DEFAULT_THEME_MANIFEST.packageId,
      version: BUNDLED_DEFAULT_THEME_MANIFEST.version,
    };

    if (themeName === CODE_TYPES.SHARED) {
      this.theme = CODE_TYPES.SHARED;
      this.themeBundle = null;
      if (installedTheme) {
        try {
          validateStoredThemePackage(
            installedTheme.manifest,
            installedTheme.bundle,
            MICROFEED_VERSION,
          );
          metadata = {
            assetBaseUrl,
            packageId: installedTheme.packageId,
            version: installedTheme.version,
          };
        } catch {
          metadata = {
            assetBaseUrl: "",
            packageId: BUNDLED_DEFAULT_THEME_MANIFEST.packageId,
            version: BUNDLED_DEFAULT_THEME_MANIFEST.version,
          };
        }
      }
    } else if (installedTheme) {
      try {
        const validated = validateStoredThemePackage(
          installedTheme.manifest,
          installedTheme.bundle,
          MICROFEED_VERSION,
        );
        this.theme = `${installedTheme.packageId}@${installedTheme.version}`;
        this.themeBundle = validated.bundle;
        metadata = {
          assetBaseUrl,
          packageId: installedTheme.packageId,
          version: installedTheme.version,
        };
      } catch (error) {
        console.error(JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          message: "Active theme is invalid or incompatible; falling back",
          themeId: installedTheme.id,
        }));
        this.theme = "default";
        this.themeBundle = null;
      }
    } else {
      this.theme = "default";
      this.themeBundle = null;
    }
    this.context = {...themeContext(jsonData, metadata), ...extraContext};
  }

  name(): string {
    return this.theme;
  }

  private sharedTemplate(file: string): string {
    return this.settings?.[SETTINGS_CATEGORIES.CUSTOM_CODE]?.[file] ?? "";
  }

  private template(file: ThemeFileKey): string {
    if (this.theme === CODE_TYPES.SHARED) return this.sharedTemplate(file);
    const installed = this.themeBundle?.[file];
    const fallback = BUNDLED_DEFAULT_THEME_BUNDLE[file];
    return typeof installed === "string"
      ? installed
      : typeof fallback === "string" ? fallback : "";
  }

  supportsPagesAndSearch(): boolean {
    const bundle = this.themeBundle ?? BUNDLED_DEFAULT_THEME_BUNDLE;
    return this.formatVersion >= 2 &&
      typeof bundle.webPage === "string" &&
      typeof bundle.webSearch === "string";
  }

  getWebHeader(): {html: string} {
    return {html: renderThemeTemplate(this.getWebHeaderTmpl(), this.context)};
  }

  getWebHeaderTmpl(): string {
    return this.template(CODE_FILES.WEB_HEADER as ThemeFileKey);
  }

  getWebBodyEnd(): {html: string} {
    return {html: renderThemeTemplate(this.getWebBodyEndTmpl(), this.context)};
  }

  getWebBodyEndTmpl(): string {
    return this.template(CODE_FILES.WEB_BODY_END as ThemeFileKey);
  }

  getWebBodyStart(): {html: string} {
    return {html: renderThemeTemplate(this.getWebBodyStartTmpl(), this.context)};
  }

  getWebBodyStartTmpl(): string {
    return this.template(CODE_FILES.WEB_BODY_START as ThemeFileKey);
  }

  getRssStylesheetTmpl(): string {
    return this.template(CODE_FILES.RSS_STYLESHEET as ThemeFileKey);
  }

  getRssStylesheet(): {stylesheet: string} {
    return {
      stylesheet: renderThemeTemplate(this.getRssStylesheetTmpl(), this.context),
    };
  }

  getWebFeed(): {html: string} {
    return {html: renderThemeTemplate(this.getWebFeedTmpl(), this.context)};
  }

  getWebFeedTmpl(): string {
    return this.template(CODE_FILES.WEB_FEED as ThemeFileKey);
  }

  getWebItem(item: Record<string, unknown>): {html: string} {
    return {
      html: renderThemeTemplate(this.getWebItemTmpl(), {
        ...this.context,
        // Deprecated compatibility alias. New themes should use items.0.
        item,
      }),
    };
  }

  getWebItemTmpl(): string {
    return this.template(CODE_FILES.WEB_ITEM as ThemeFileKey);
  }

  getWebPage(
    page: object,
    navigationPages: object[] = [],
    extraContext: Record<string, unknown> = {},
  ): {html: string} {
    return {
      html: renderThemeTemplate(this.getWebPageTmpl(), {
        ...this.context,
        ...extraContext,
        navigation_pages: navigationPages,
        page,
        is_contact_page: String((page as {slug?: unknown})?.slug) === "contact",
      }),
    };
  }

  getWebPageTmpl(): string {
    return this.template("webPage");
  }

  getWebSearch(
    query = "",
    results: Array<Record<string, unknown>> = [],
  ): {html: string} {
    return {
      html: renderThemeTemplate(this.getWebSearchTmpl(), {
        ...this.context,
        search: {query, results},
      }),
    };
  }

  getWebSearchTmpl(): string {
    return this.template("webSearch");
  }
}
