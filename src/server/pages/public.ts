import {CODE_TYPES} from "@/shared/Constants";
import {DEFAULT_NOT_FOUND_PAGE_SLUG} from "@/shared/Pages";
import {loadPublishedFeed, shouldHidePublicWeb} from "@/server/feed/feed";
import Theme, {themeSupportsPagesAndSearch} from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import {
  navigationPages,
  resolvePagePath,
  type ResolvedPagePath,
} from "./service";

interface PublicPageLayoutData {
  bodyEnd: string;
  bodyHtml: string;
  bodyStart: string;
  canonicalUrl?: string;
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
  | {kind: "page"; layout: PublicPageLayoutData; status: 200 | 404};

export async function loadPublicPageRoute(
  runtimeEnv: Env,
  request: Request,
  slug: string,
): Promise<PublicPageRouteResult> {
  const loaded = await loadPublishedFeed(runtimeEnv, request, {
    includeActiveTheme: true,
    limit: 1,
  });
  const requested = slug.length > 0 && !slug.includes("/")
    ? await resolvePagePath(loaded.database.FEED_DB, request, slug)
    : null;
  if (
    shouldHidePublicWeb(loaded.content) ||
    !themeSupportsPagesAndSearch(loaded.content.activeTheme)
  ) {
    return {kind: "not-found"};
  }
  if (requested?.redirect) {
    return {kind: "redirect", location: requested.page.url};
  }
  const resolved: ResolvedPagePath | null = requested ??
    await resolvePagePath(
      loaded.database.FEED_DB,
      request,
      DEFAULT_NOT_FOUND_PAGE_SLUG,
    );
  if (!resolved) return {kind: "not-found"};
  const fallback = !requested;

  const navigation = await navigationPages(loaded.database.FEED_DB, request);
  const webSettings = loaded.content.settings?.webGlobalSettings ?? {};
  const assetBaseUrl = themeAssetBaseUrl(
    runtimeEnv,
    request.url,
    loaded.content.activeTheme?.assetOwnerThemeId,
    loaded.content.activeTheme?.bundle.assets,
    webSettings.publicBucketUrl,
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
  const contactSent = new URL(request.url).searchParams.get("sent") === "1";

  return {
    kind: "page",
    layout: {
      bodyEnd: theme.getWebBodyEnd().html,
      bodyHtml: theme.getWebPage(resolved.page, navigation, {
        contact_sent: contactSent,
      }).html,
      bodyStart: theme.getWebBodyStart().html,
      ...(fallback ? {} : {canonicalUrl: resolved.page.url}),
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
    status: fallback || resolved.page.is_not_found_page ? 404 : 200,
  };
}

export async function loadPublicNotFoundPageRoute(
  runtimeEnv: Env,
  request: Request,
): Promise<PublicPageRouteResult> {
  return loadPublicPageRoute(runtimeEnv, request, "");
}
