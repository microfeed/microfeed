import {escapeHtml} from "@/shared/StringUtils";
import {loadPublishedFeed, shouldHidePublicWeb} from "@/server/feed/feed";
import {listPages} from "@/server/pages/service";
import {getSiteFileByName} from "./service";

function notFound(): Response {
  return new Response("Not Found", {status: 404, statusText: "Not Found"});
}

function robotsContent(request: Request, hidden: boolean): string {
  if (hidden) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", request.url)}\n`;
}

async function llmsContent(
  loaded: Awaited<ReturnType<typeof loadPublishedFeed>>,
  request: Request,
): Promise<string> {
  const pages = await listPages(loaded.database, request, {
    limit: 100,
    statuses: ["published"],
  });
  const feed = loaded.publicFeed;
  const lines = [
    `# ${String(feed.title ?? "microfeed")}`,
    "",
    String(feed._microfeed?.description_text ?? feed.description ?? "").trim(),
    "",
    `- Website: ${new URL("/", request.url)}`,
    `- JSON Feed: ${new URL("/json/", request.url)}`,
    `- RSS Feed: ${new URL("/rss/", request.url)}`,
  ];
  if (pages.items.length > 0) {
    lines.push("", "## Pages", "");
    for (const page of pages.items) {
      lines.push(`- [${page.title}](${page.url})${page.meta_description ? `: ${page.meta_description}` : ""}`);
    }
  }
  if (feed.items.length > 0) {
    lines.push("", "## Recent items", "");
    for (const item of feed.items.slice(0, 20)) {
      const extra = item._microfeed ?? {};
      const title = String(item.title ?? "Untitled");
      const url = String(extra.web_url ?? item.url ?? "");
      lines.push(`- [${title}](${url})`);
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

async function sitemapContent(
  loaded: Awaited<ReturnType<typeof loadPublishedFeed>>,
  request: Request,
): Promise<string> {
  const pages = await listPages(loaded.database, request, {
    limit: 100,
    statuses: ["published"],
  });
  const feed = loaded.publicFeed;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
    'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
  xml += `<url><loc>${escapeHtml(String(feed.home_page_url ?? new URL("/", request.url)))}</loc>`;
  if (feed.icon) {
    xml += `<image:image><image:loc>${escapeHtml(feed.icon)}</image:loc></image:image>`;
  }
  xml += "</url>";
  for (const page of pages.items) {
    xml += `<url><loc>${escapeHtml(page.url)}</loc>`;
    xml += `<lastmod>${escapeHtml(page.date_modified)}</lastmod></url>`;
  }
  for (const item of feed.items) {
    const extra = item._microfeed ?? {};
    xml += `<url><loc>${escapeHtml(String(extra.web_url ?? ""))}</loc>`;
    if (item.date_published) {
      xml += `<lastmod>${escapeHtml(String(item.date_published))}</lastmod>`;
    }
    const attachments = Array.isArray(item.attachments)
      ? item.attachments as Array<Record<string, unknown>>
      : [];
    for (const attachment of attachments) {
      const mimeType = String(attachment.mime_type ?? "");
      const url = escapeHtml(String(attachment.url ?? ""));
      if (mimeType.startsWith("image/")) {
        xml += `<image:image><image:loc>${url}</image:loc></image:image>`;
      } else if (mimeType.startsWith("video/")) {
        xml += "<video:video>" +
          `<video:title>${escapeHtml(String(item.title ?? ""))}</video:title>` +
          (item.date_published
            ? `<video:publication_date>${escapeHtml(String(item.date_published))}</video:publication_date>`
            : "") +
          `<video:content_loc>${url}</video:content_loc></video:video>`;
      }
    }
    xml += "</url>";
  }
  return `${xml}</urlset>`;
}

export async function publicSiteFileResponse(
  runtimeEnv: Env,
  request: Request,
  filename: string,
): Promise<Response> {
  const loaded = await loadPublishedFeed(runtimeEnv, request, {
    includeActiveTheme: true,
    limit: filename === "sitemap.xml" ? -1 : 20,
  });
  const siteFile = await getSiteFileByName(
    loaded.database.FEED_DB,
    request,
    filename,
  );
  if (!siteFile?.enabled) return notFound();
  const hidden = shouldHidePublicWeb(loaded.content);
  let content: string | undefined;
  if (filename === "robots.txt" && hidden) {
    content = robotsContent(request, true);
  } else if (hidden) {
    return notFound();
  } else if (siteFile.mode === "override") {
    content = siteFile.published_content;
  } else if (siteFile.generator === "robots") {
    content = robotsContent(request, false);
  } else if (siteFile.generator === "llms") {
    content = await llmsContent(loaded, request);
  } else if (siteFile.generator === "sitemap") {
    content = await sitemapContent(loaded, request);
  }
  if (content === undefined) return notFound();
  return new Response(content, {
    headers: {
      "content-type": `${siteFile.content_type}; charset=utf-8`,
      "x-content-type-options": "nosniff",
    },
  });
}
