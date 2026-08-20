import {loadPublishedFeed} from "@/server/feed/feed";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import type {
  StoredThemeVersion,
  ThemeDraft,
} from "@/shared/themes/ThemeContract";
import {themeRssPreviewDocument} from "@/shared/themes/RssPreview";
import {
  publicSearchHtml,
  type PublicSearchResult,
} from "@/shared/PublicSearch";
import {
  manifestSearchItemDestination,
  resolveThemeSearchItemUrl,
} from "@/shared/themes/ThemeSearch";

type PreviewTheme = StoredThemeVersion | ThemeDraft;

function previewVersion(theme: PreviewTheme): StoredThemeVersion {
  if ("checksumSha256" in theme) return theme;
  return {
    assetOwnerThemeId: theme.assetOwnerThemeId,
    bundle: theme.bundle,
    checksumSha256: "0".repeat(64),
    createdAt: theme.createdAt,
    deletedAt: null,
    id: theme.id,
    manifest: theme.manifest,
    name: theme.name,
    originThemeId: theme.originThemeId,
    packageId: theme.packageId,
    sourceCommit: null,
    sourceKind: "admin",
    sourcePath: null,
    sourceRef: null,
    sourceUrl: null,
    version: theme.version,
  };
}

function previewHeaders(
  requestUrl: string,
  contentType = "text/html; charset=utf-8",
): Headers {
  // A sandboxed iframe without allow-same-origin receives an opaque origin, so
  // CSP 'self' does not match even the site's own public images or theme assets.
  // Allow the exact request origin while keeping the iframe isolated from Admin.
  const requestOrigin = new URL(requestUrl).origin;
  return new Headers({
    "cache-control": "private, no-store",
    "content-security-policy": [
      "sandbox allow-scripts",
      `default-src ${requestOrigin} https: data: blob:`,
      `img-src ${requestOrigin} https: data: blob:`,
      `font-src ${requestOrigin} https: data:`,
      `script-src ${requestOrigin} https: 'unsafe-inline' 'unsafe-eval'`,
      `style-src ${requestOrigin} https: data: 'unsafe-inline'`,
      `connect-src ${requestOrigin} https:`,
    ].join("; "),
    "content-type": contentType,
    "referrer-policy": "no-referrer",
  });
}

export async function themePreviewResponse(
  runtimeEnv: Env,
  request: Request,
  previewTheme: PreviewTheme,
): Promise<Response> {
  const view = new URL(request.url).searchParams.get("view") ?? "feed";
  const supportsPagesAndSearch = previewTheme.manifest.formatVersion === 2;
  if (
    !["feed", "item", "rss", "rss-stylesheet", "page", "search"].includes(view) ||
    (!supportsPagesAndSearch && (view === "page" || view === "search"))
  ) {
    return new Response("Unknown preview view.", {status: 400});
  }
  const loaded = await loadPublishedFeed(runtimeEnv, request, {limit: 20});
  const previewPublishedAt = loaded.publicFeed.items
    .map((item) => item.date_published)
    .find((value): value is string => typeof value === "string") ??
    new Date().toISOString();
  const storedTheme = previewVersion(previewTheme);
  const assetBaseUrl = themeAssetBaseUrl(
    runtimeEnv,
    request.url,
    storedTheme.assetOwnerThemeId,
    storedTheme.bundle.assets,
    loaded.content.settings?.webGlobalSettings?.publicBucketUrl,
  );
  const page = {
    content_html: "<p>This is a standalone Page preview.</p>",
    content_text: "This is a standalone Page preview.",
    date_created: previewPublishedAt,
    date_modified: previewPublishedAt,
    date_published: previewPublishedAt,
    id: "preview-page",
    is_not_found_page: false,
    meta_description: "Learn more about this site.",
    navigation_label: "About",
    navigation_order: 10,
    show_in_navigation: true,
    slug: "about",
    status: "published",
    title: "About",
    url: new URL("/about/", request.url).toString(),
  };
  const navigationPages = [
    page,
    {
      id: "preview-contact-page",
      navigation_label: "Contact",
      navigation_order: 20,
      slug: "contact",
      title: "Contact",
      url: new URL("/contact/", request.url).toString(),
    },
    {
      id: "preview-projects-page",
      navigation_label: "Projects",
      navigation_order: 30,
      slug: "projects",
      title: "Projects",
      url: new URL("/projects/", request.url).toString(),
    },
  ];
  const extraContext = {navigation_pages: navigationPages};
  const searchItemDestination = manifestSearchItemDestination(
    storedTheme.manifest,
  );
  const previewSearchResults: PublicSearchResult[] = loaded.publicFeed.items
    .slice(0, 5)
    .map((item, index) => {
      const microfeed = item._microfeed as Record<string, unknown> | undefined;
      const attachmentValue = Array.isArray(item.attachments)
        ? item.attachments[0]
        : undefined;
      const attachment = attachmentValue && typeof attachmentValue === "object"
        ? attachmentValue as Record<string, unknown>
        : undefined;
      const webUrl = typeof microfeed?.web_url === "string"
        ? microfeed.web_url
        : new URL(`/i/preview-item-${index + 1}/`, request.url).toString();
      return {
        content_text: String(item.content_text ?? "Published item preview"),
        date_published: typeof item.date_published === "string"
          ? item.date_published
          : previewPublishedAt,
        id: typeof item.id === "string" ? item.id : `preview-item-${index + 1}`,
        title: typeof item.title === "string" && item.title.trim()
          ? item.title
          : `Preview item ${index + 1}`,
        type: "item" as const,
        url: resolveThemeSearchItemUrl(searchItemDestination, {
          attachmentUrl: typeof attachment?.url === "string"
            ? attachment.url
            : undefined,
          itemUrl: typeof item.url === "string" ? item.url : undefined,
          webUrl,
        }),
      };
    });
  if (previewSearchResults.length === 0) {
    previewSearchResults.push({
      content_text: "This representative item shows how a search result is styled.",
      date_published: previewPublishedAt,
      id: "preview-item",
      title: "Preview item",
      type: "item",
      url: new URL("/i/preview-item/", request.url).toString(),
    });
  }
  for (const navigationPage of navigationPages) {
    previewSearchResults.push({
      content_text: navigationPage.id === page.id
        ? page.content_text
        : `Representative content for the ${navigationPage.title} Page.`,
      date_published: previewPublishedAt,
      id: navigationPage.id,
      title: navigationPage.title,
      type: "page",
      url: navigationPage.url,
    });
  }
  const theme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    null,
    storedTheme,
    assetBaseUrl,
    extraContext,
  );
  if (view === "rss-stylesheet") {
    return new Response(theme.getRssStylesheet().stylesheet, {
      headers: previewHeaders(request.url, "text/xsl; charset=utf-8"),
    });
  }
  if (view === "rss") {
    const stylesheet = theme.getRssStylesheet().stylesheet;
    const stylesheetUrl = new URL(request.url);
    stylesheetUrl.search = "?view=rss-stylesheet";
    const rss = new FeedPublicRssBuilder(
      loaded.publicFeed,
      new URL(request.url).origin,
    ).getRssData().replace(
      /<\?xml-stylesheet href="[^"]+" type="text\/xsl"\?>/u,
      `<?xml-stylesheet href="${stylesheetUrl.href}" type="text/xsl"?>`,
    );
    return new Response(themeRssPreviewDocument(rss, stylesheet), {
      headers: previewHeaders(request.url),
    });
  }

  const shared = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    "shared",
    storedTheme,
    assetBaseUrl,
    extraContext,
  );
  const item = loaded.publicFeed.items[0] ?? {};
  const body = view === "item"
    ? theme.getWebItem(item).html
    : view === "page"
    ? theme.getWebPage(page, navigationPages).html
    : view === "search"
    ? theme.getWebSearch("", previewSearchResults).html
    : theme.getWebFeed().html;
  const publicSearch = supportsPagesAndSearch
    ? publicSearchHtml({previewResults: previewSearchResults})
    : "";
  return new Response(
    `<!doctype html><html lang="${String(loaded.publicFeed.language ?? "en")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${shared.getWebHeader().html}${theme.getWebHeader().html}</head><body>${shared.getWebBodyStart().html}${theme.getWebBodyStart().html}${body}${shared.getWebBodyEnd().html}${theme.getWebBodyEnd().html}${publicSearch}</body></html>`,
    {headers: previewHeaders(request.url)},
  );
}
