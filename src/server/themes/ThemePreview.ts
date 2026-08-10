import {loadPublishedFeed} from "@/server/feed/feed";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import Theme from "@/server/themes/Theme";
import {themeAssetBaseUrl} from "@/server/themes/ThemeAssets";
import type {
  StoredThemeVersion,
  ThemeDraft,
} from "@/shared/themes/ThemeContract";

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

function previewHeaders(contentType = "text/html; charset=utf-8"): Headers {
  return new Headers({
    "cache-control": "private, no-store",
    "content-security-policy": [
      "sandbox allow-scripts",
      "default-src 'self' https: data: blob:",
      "img-src 'self' https: data: blob:",
      "font-src 'self' https: data:",
      "script-src 'self' https: 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' https: data: 'unsafe-inline'",
      "connect-src https:",
    ].join("; "),
    "content-type": contentType,
    "referrer-policy": "no-referrer",
  });
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function themePreviewResponse(
  runtimeEnv: Env,
  request: Request,
  previewTheme: PreviewTheme,
): Promise<Response> {
  const view = new URL(request.url).searchParams.get("view") ?? "feed";
  if (!["feed", "item", "rss"].includes(view)) {
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
  if (view === "rss") {
    const stylesheet = theme.getRssStylesheet().stylesheet;
    const stylesheetUrl = `data:text/xsl;base64,${base64Utf8(stylesheet)}`;
    const rss = new FeedPublicRssBuilder(
      loaded.publicFeed,
      new URL(request.url).origin,
    ).getRssData().replace(
      /<\?xml-stylesheet href="[^"]+" type="text\/xsl"\?>/u,
      `<?xml-stylesheet href="${stylesheetUrl}" type="text/xsl"?>`,
    );
    return new Response(
      rss,
      {headers: previewHeaders("application/rss+xml; charset=utf-8")},
    );
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
    {headers: previewHeaders()},
  );
}
