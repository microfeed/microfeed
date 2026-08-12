import {CODE_TYPES} from "@/shared/Constants";
import {loadPublishedFeed, shouldHidePublicWeb} from "@/server/feed/feed";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import {navigationPages, resolvePagePath} from "./service";

interface PublicPageLayoutData {
  bodyEnd: string;
  bodyHtml: string;
  bodyStart: string;
  canonicalUrl: string;
  channelImage: string;
  description: string;
  favicon?: {
    contentType?: string;
    url?: string;
  };
  headHtml: string;
  language?: string;
  publicBucketUrl?: string;
  searchEnabled: boolean;
  sharedBodyEnd: string;
  sharedBodyStart: string;
  sharedHeadHtml: string;
  title: string;
}

export type PublicPageRouteResult =
  | {kind: "not-found"}
  | {kind: "redirect"; location: string}
  | {kind: "page"; layout: PublicPageLayoutData};

export async function loadPublicPageRoute(
  runtimeEnv: Env,
  request: Request,
  slug: string,
): Promise<PublicPageRouteResult> {
  const loaded = await loadPublishedFeed(runtimeEnv, request, {
    includeActiveTheme: true,
    limit: 1,
  });
  const resolved = slug && !slug.includes("/")
    ? await resolvePagePath(loaded.database.FEED_DB, request, slug)
    : null;
  if (
    shouldHidePublicWeb(loaded.content) ||
    loaded.content.activeTheme?.manifest.formatVersion !== 2 ||
    !resolved
  ) {
    return {kind: "not-found"};
  }
  if (resolved.redirect) {
    return {kind: "redirect", location: resolved.page.url};
  }

  const navigation = await navigationPages(loaded.database.FEED_DB, request);
  const assetBaseUrl = themeAssetBaseUrl(
    runtimeEnv,
    request.url,
    loaded.content.activeTheme.assetOwnerThemeId,
    loaded.content.activeTheme.bundle.assets,
  );
  const extraContext = {navigation_pages: navigation};
  const theme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    null,
    loaded.content.activeTheme,
    assetBaseUrl,
    extraContext,
  );
  const sharedTheme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    CODE_TYPES.SHARED,
    loaded.content.activeTheme,
    assetBaseUrl,
    extraContext,
  );
  const webSettings = loaded.content.settings?.webGlobalSettings ?? {};

  return {
    kind: "page",
    layout: {
      bodyEnd: theme.getWebBodyEnd().html,
      bodyHtml: theme.getWebPage(resolved.page, navigation).html,
      bodyStart: theme.getWebBodyStart().html,
      canonicalUrl: resolved.page.url,
      channelImage: String(loaded.content.channel?.image ?? ""),
      description: resolved.page.meta_description ?? resolved.page.content_text,
      favicon: webSettings.favicon,
      headHtml: theme.getWebHeader().html,
      language: loaded.publicFeed.language,
      publicBucketUrl: webSettings.publicBucketUrl,
      searchEnabled: true,
      sharedBodyEnd: sharedTheme.getWebBodyEnd().html,
      sharedBodyStart: sharedTheme.getWebBodyStart().html,
      sharedHeadHtml: sharedTheme.getWebHeader().html,
      title: resolved.page.title,
    },
  };
}
