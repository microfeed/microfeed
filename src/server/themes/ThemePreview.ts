import {loadPublishedFeed} from "@/server/feed/feed";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import type {
  StoredThemeVersion,
  ThemeDraft,
} from "@/shared/themes/ThemeContract";
import {themeRssPreviewDocument} from "@/shared/themes/RssPreview";

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
  if (!["feed", "item", "rss", "rss-stylesheet"].includes(view)) {
    return new Response("Unknown preview view.", {status: 400});
  }
  const loaded = await loadPublishedFeed(runtimeEnv, request, {limit: 20});
  const storedTheme = previewVersion(previewTheme);
  const assetBaseUrl = themeAssetBaseUrl(
    runtimeEnv,
    request.url,
    storedTheme.assetOwnerThemeId,
    storedTheme.bundle.assets,
  );
  const theme = new Theme(
    loaded.publicFeed,
    loaded.content.settings,
    null,
    storedTheme,
    assetBaseUrl,
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
  );
  const item = loaded.publicFeed.items[0] ?? {};
  const body = view === "item"
    ? theme.getWebItem(item).html
    : theme.getWebFeed().html;
  return new Response(
    `<!doctype html><html lang="${String(loaded.publicFeed.language ?? "en")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${shared.getWebHeader().html}${theme.getWebHeader().html}</head><body>${shared.getWebBodyStart().html}${theme.getWebBodyStart().html}${body}${shared.getWebBodyEnd().html}${theme.getWebBodyEnd().html}</body></html>`,
    {headers: previewHeaders(request.url)},
  );
}
