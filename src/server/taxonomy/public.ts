import {CODE_TYPES} from "@/shared/Constants";
import {PUBLIC_URLS} from "@/shared/StringUtils";
import type {SeriesKind} from "@/shared/Series";
import {loadPublishedFeed, shouldHidePublicWeb, type LoadedFeed} from "@/server/feed/feed";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import {navigationPages} from "@/server/pages/service";
import {getCategoryBySlug} from "@/server/categories/service";
import {getSeriesBySlug} from "@/server/series/service";
import type {PublicFeed} from "@/types";

interface TaxonomyLandingLayout {
  bodyEnd: string;
  bodyHtml: string;
  bodyStart: string;
  canonicalUrl: string;
  channelImage: string;
  description: string;
  favicon?: {contentType?: string; url?: string};
  headHtml: string;
  language?: string;
  publicBucketUrl?: string;
  searchEnabled: boolean;
  sharedBodyEnd: string;
  sharedBodyStart: string;
  sharedHeadHtml: string;
  title: string;
}

export type TaxonomyLandingResult =
  | {kind: "not-found"}
  | {kind: "page"; layout: TaxonomyLandingLayout; status: 200};

interface LandingOptions {
  canonicalUrl: string;
  description: string;
  items: Array<Record<string, unknown>>;
  title: string;
}

/**
 * Renders a category or series landing page by reusing the theme's feed
 * template with a filtered item list. The heading becomes the taxonomy name
 * and the list shows only the matching published items.
 */
async function buildLandingLayout(
  runtimeEnv: Env,
  request: Request,
  loaded: LoadedFeed & {publicFeed: PublicFeed},
  options: LandingOptions,
): Promise<TaxonomyLandingLayout> {
  const navigation = await navigationPages(loaded.database.FEED_DB, request);
  const assetBaseUrl = themeAssetBaseUrl(
    runtimeEnv,
    request.url,
    loaded.content.activeTheme?.assetOwnerThemeId,
    loaded.content.activeTheme?.bundle.assets,
  );
  const extraContext = {navigation_pages: navigation};
  const landingFeed = {
    ...loaded.publicFeed,
    title: options.title,
    description: options.description || undefined,
    items: options.items,
    _microfeed: {
      ...loaded.publicFeed._microfeed,
      next_url: undefined,
      prev_url: undefined,
    },
  };
  const theme = new Theme(
    landingFeed,
    loaded.content.settings,
    null,
    loaded.content.activeTheme,
    assetBaseUrl,
    extraContext,
  );
  const sharedTheme = new Theme(
    landingFeed,
    loaded.content.settings,
    CODE_TYPES.SHARED,
    loaded.content.activeTheme,
    assetBaseUrl,
    extraContext,
  );
  const webSettings = loaded.content.settings?.webGlobalSettings ?? {};
  return {
    bodyEnd: theme.getWebBodyEnd().html,
    bodyHtml: theme.getWebFeed().html,
    bodyStart: theme.getWebBodyStart().html,
    canonicalUrl: options.canonicalUrl,
    channelImage: String(loaded.content.channel?.image ?? ""),
    description: options.description,
    favicon: webSettings.favicon,
    headHtml: theme.getWebHeader().html,
    language: loaded.publicFeed.language,
    publicBucketUrl: webSettings.publicBucketUrl,
    searchEnabled: theme.supportsPagesAndSearch(),
    sharedBodyEnd: sharedTheme.getWebBodyEnd().html,
    sharedBodyStart: sharedTheme.getWebBodyStart().html,
    sharedHeadHtml: sharedTheme.getWebHeader().html,
    title: options.title,
  };
}

export async function loadCategoryLandingPage(
  runtimeEnv: Env,
  request: Request,
  slug: string,
): Promise<TaxonomyLandingResult> {
  const loaded = await loadPublishedFeed(runtimeEnv, request, {
    includeActiveTheme: true,
  });
  if (shouldHidePublicWeb(loaded.content)) return {kind: "not-found"};
  const category = await getCategoryBySlug(loaded.database.FEED_DB, slug);
  if (!category) return {kind: "not-found"};
  const items = loaded.publicFeed.items.filter((item: any) =>
    Array.isArray(item.categories) &&
    item.categories.some((entry: any) => entry.slug === category.slug),
  );
  const canonicalUrl = PUBLIC_URLS.webCategory(
    category.slug,
    new URL(request.url).origin,
  );
  return {
    kind: "page",
    layout: await buildLandingLayout(runtimeEnv, request, loaded, {
      canonicalUrl,
      description: category.name,
      items,
      title: category.name,
    }),
    status: 200,
  };
}

export async function loadSeriesLandingPage(
  runtimeEnv: Env,
  request: Request,
  kind: SeriesKind,
  slug: string,
): Promise<TaxonomyLandingResult> {
  const loaded = await loadPublishedFeed(runtimeEnv, request, {
    includeActiveTheme: true,
  });
  if (shouldHidePublicWeb(loaded.content)) return {kind: "not-found"};
  const series = await getSeriesBySlug(loaded.database.FEED_DB, kind, slug);
  if (!series) return {kind: "not-found"};
  const items = loaded.publicFeed.items.filter((item: any) =>
    item.series && item.series.slug === series.slug,
  );
  const canonicalUrl = PUBLIC_URLS.webSeries(
    series.kind,
    series.slug,
    new URL(request.url).origin,
  );
  return {
    kind: "page",
    layout: await buildLandingLayout(runtimeEnv, request, loaded, {
      canonicalUrl,
      description: series.description ?? series.name,
      items,
      title: series.name,
    }),
    status: 200,
  };
}
