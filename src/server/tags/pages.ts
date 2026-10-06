import {env} from "cloudflare:workers";
import Theme from "@/server/themes/Theme";
import {CODE_TYPES} from "@/shared/Constants";
import {adminBasePath} from "@/shared/AdminPath";
import {escapeHtml} from "@/shared/StringUtils";
import {TagRequestError} from "@/shared/Tags";
import {loadPublishedFeed, shouldHidePublicWeb} from "@/server/feed/feed";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import {navigationPages} from "@/server/pages/service";
import {resolveMetadata} from "@/server/seo/metadata";
import {loadTagFeed, tagListCursor} from "./public";
import {listTags} from "./service";
import {tagDirectoryContext} from "@/shared/themes/ThemeTags";
import type {ThemeTagDirectory} from "@/shared/themes/ThemeContract";

export async function publicTagPage(request: Request, path: string) {
  const url = new URL(request.url);
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 1) return new Response("Not Found", {status: 404});
  const tagged = parts[0] ? await loadTagFeed(request, parts[0]) : undefined;
  if (tagged instanceof Response) return tagged;
  const loaded = tagged ?? await loadPublishedFeed(env, request, {includeActiveTheme: true, includeItems: false});
  if (shouldHidePublicWeb(loaded.content)) return new Response("Not Found", {status: 404});
  if (!loaded.onboarding.requiredOk) return Response.redirect(new URL(adminBasePath(env.MICROFEED_ADMIN_PATH), url), 302);
  const tag = tagged?.tag;
  const feed = tagged?.tagFeed ?? loaded.publicFeed;
  const shell = {...feed, title: loaded.publicFeed.title, description: loaded.publicFeed.description, home_page_url: loaded.publicFeed.home_page_url};
  const settings = loaded.content.settings;
  const webSettings = settings?.webGlobalSettings ?? {};
  const activeTheme = loaded.content.activeTheme;
  const assets = themeAssetBaseUrl(env, request.url, activeTheme?.assetOwnerThemeId, activeTheme?.bundle.assets, webSettings.publicBucketUrl);
  let directoryContext: ThemeTagDirectory | undefined;
  if (!tag) {
    try {
      const directory = await listTags(env.FEED_DB, url.origin, 50, tagListCursor(request));
      const methods = settings?.subscribeMethods?.methods ?? [];
      const enabled = (format: string) => !methods.some(method => method.type === format && method.editable === false && method.enabled === false);
      const next = new URL("/tags/", url);
      if (directory.next_cursor) next.searchParams.set("next_cursor", directory.next_cursor);
      directoryContext = tagDirectoryContext(directory.items, new URL("/tags/", url).href, {
        nextUrl: directory.next_cursor ? next.href : undefined,
        rssEnabled: enabled("rss"), jsonEnabled: enabled("json"),
      });
    } catch (error) {
      if (error instanceof TagRequestError) return new Response(error.message, {status: 400});
      throw error;
    }
  }
  const extra = {navigation_pages: await navigationPages(env.FEED_DB, request), tags_active: true,
    ...(directoryContext ? {tags: directoryContext} : {})};
  const theme = new Theme(shell, settings, null, activeTheme, assets, extra);
  const shared = new Theme(shell, settings, CODE_TYPES.SHARED, activeTheme, assets, extra);
  const body = tag
    ? new Theme({...feed, description: escapeHtml(tag.description)}, settings, null, activeTheme, assets, extra).getWebTag().html
    : theme.getWebTags().html;
  const metadata = await resolveMetadata({feed: loaded.publicFeed, origin: url.origin,
    archive: {title: `${tag?.name ?? "Tags"} | ${loaded.publicFeed.title}`, description: tag?.description ?? "Browse all public tags.", url: tag?.url ?? new URL("/tags/", url).href},
    headHtml: shared.getWebHeader().html + theme.getWebHeader().html});
  const metadataHtml = tag ? await new HTMLRewriter().on('link[rel="alternate"]', {
    element(element) {
      const type = element.getAttribute("type");
      if (type === "application/rss+xml") element.setAttribute("href", tag.rss_url);
      if (type === "application/feed+json" || type === "application/json") element.setAttribute("href", tag.json_url);
    },
  }).transform(new Response(metadata.headHtml)).text() : metadata.headHtml;
  return {metadataHtml, title: tag?.name ?? "Tags", language: loaded.publicFeed.language,
    favicon: webSettings.favicon, channelImage: String(loaded.content.channel?.image ?? ""), publicBucketUrl: webSettings.publicBucketUrl,
    headHtml: theme.getWebHeader().html, sharedHeadHtml: shared.getWebHeader().html,
    bodyStart: theme.getWebBodyStart().html, sharedBodyStart: shared.getWebBodyStart().html,
    bodyHtml: body, bodyEnd: theme.getWebBodyEnd().html, sharedBodyEnd: shared.getWebBodyEnd().html,
    tagPage: true, searchEnabled: theme.supportsPagesAndSearch()};
}
