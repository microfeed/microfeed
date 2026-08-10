import {CODE_FILES, CODE_TYPES, SETTINGS_CATEGORIES} from "@/shared/Constants";
import type {
  StoredThemeVersion,
  ThemeBundleV1,
  ThemeFileKey,
} from "@/shared/themes/ThemeContract";
import {
  renderThemeTemplate,
  themeContext,
  type ThemeRuntimeMetadata,
} from "@/shared/themes/ThemeRenderer";
import {validateThemePackage} from "@/shared/themes/ThemeValidation";
import {MICROFEED_VERSION} from "@/shared/Version";
import {
  BUILT_IN_THEME_BUNDLE,
  BUILT_IN_THEME_MANIFEST,
} from "./BuiltInTheme";

type Settings = Record<string, any> | null;

export default class Theme {
  private readonly context: Record<string, unknown>;
  private readonly settings: Settings;
  private readonly theme: string;
  private readonly themeBundle: ThemeBundleV1 | Record<string, string> | null;

  constructor(
    jsonData: Record<string, unknown>,
    settings: Settings = null,
    themeName: string | null = null,
    installedTheme: StoredThemeVersion | null = null,
    assetBaseUrl = "",
  ) {
    this.settings = settings;
    let metadata: ThemeRuntimeMetadata = {
      assetBaseUrl: "",
      packageId: BUILT_IN_THEME_MANIFEST.packageId,
      version: BUILT_IN_THEME_MANIFEST.version,
    };

    if (themeName === CODE_TYPES.SHARED) {
      this.theme = CODE_TYPES.SHARED;
      this.themeBundle = null;
      if (installedTheme) {
        try {
          validateThemePackage(
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
            packageId: BUILT_IN_THEME_MANIFEST.packageId,
            version: BUILT_IN_THEME_MANIFEST.version,
          };
        }
      }
    } else if (installedTheme) {
      try {
        const validated = validateThemePackage(
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
    this.context = themeContext(jsonData, metadata);
  }

  name(): string {
    return this.theme;
  }

  private sharedTemplate(file: string): string {
    return this.settings?.[SETTINGS_CATEGORIES.CUSTOM_CODE]?.[file] ?? "";
  }

  private template(file: ThemeFileKey): string {
    if (this.theme === CODE_TYPES.SHARED) return this.sharedTemplate(file);
    return this.themeBundle?.[file] ?? BUILT_IN_THEME_BUNDLE[file];
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
}
