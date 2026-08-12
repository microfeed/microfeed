import {SyntaxValidator} from "fast-xml-validator";

import {STATUSES} from "@/shared/Constants";
import {getFetchItemsParams} from "@/server/feed/FeedDb";
import type FeedDb from "@/server/feed/FeedDb";
import {listPages} from "@/server/pages/service";
import {ITEM_ORDERS, ITEM_SORTS} from "@/shared/ItemPagination";
import {
  type SiteFileGenerator,
  type SiteFileMediaType,
  validateSiteFileContent,
} from "@/shared/SiteFiles";
import {
  renderSiteFileTemplate,
  validateSiteFileTemplateSource,
} from "@/shared/SiteFileTemplates";
import type {FeedContent, PublicFeed} from "@/types";

export interface SiteFileRenderInput {
  allowLargeGeneratedSitemap?: boolean;
  contentType: SiteFileMediaType;
  filename: string;
  generator?: SiteFileGenerator;
  template: string;
}

export interface SiteFileRenderResult {
  content: string;
  context: Record<string, unknown>;
  feedContent: FeedContent;
}

interface Attachment extends Record<string, unknown> {
  mime_type?: unknown;
  url?: unknown;
}

function loopMetadata(index: number, length: number) {
  return {
    first: index === 0,
    index: index + 1,
    index0: index,
    last: index === length - 1,
  };
}

function itemTemplateContext(
  item: PublicFeed["items"][number],
  index: number,
  length: number,
): Record<string, unknown> {
  const attachments = Array.isArray(item.attachments)
    ? item.attachments as Attachment[]
    : [];
  const title = String(item.title ?? "Untitled");
  const datePublished = typeof item.date_published === "string"
    ? item.date_published
    : undefined;
  const webUrl = String(
    item._microfeed?.web_url ?? item.url ?? "",
  );
  const images = attachments
    .filter((attachment) =>
      String(attachment.mime_type ?? "").startsWith("image/") &&
      Boolean(attachment.url)
    )
    .map((attachment) => ({url: String(attachment.url)}));
  const videos = attachments
    .filter((attachment) =>
      String(attachment.mime_type ?? "").startsWith("video/") &&
      Boolean(attachment.url)
    )
    .map((attachment) => ({
      ...(datePublished ? {date_published: datePublished} : {}),
      title,
      url: String(attachment.url),
    }));
  return {
    ...item,
    title,
    _loop: loopMetadata(index, length),
    _site: {
      images,
      videos,
      web_url: webUrl,
    },
  };
}

export function validateRenderedSiteFile(
  content: string,
  contentType: SiteFileMediaType,
  options: {allowLargeGeneratedSitemap?: boolean} = {},
): string | undefined {
  const error = validateSiteFileContent(content, contentType, options);
  if (error) return error;
  if (
    contentType === "application/xml" ||
    contentType === "application/rss+xml"
  ) {
    try {
      SyntaxValidator.validate(content);
    } catch {
      return "Publish valid XML content.";
    }
  }
  return undefined;
}

export async function renderSiteFileForRequest(
  database: FeedDb,
  request: Request,
  input: SiteFileRenderInput,
  loadedFeed?: {feedContent: FeedContent; publicFeed: PublicFeed},
): Promise<SiteFileRenderResult> {
  const sourceError = validateSiteFileTemplateSource(input.template);
  if (sourceError) throw new Error(sourceError);
  const itemLimit = input.generator === "sitemap" ? -1 : 20;
  const feedContent = loadedFeed?.feedContent ??
    await database.getContent(getFetchItemsParams(
      request,
      {status: STATUSES.PUBLISHED},
      itemLimit,
      ITEM_SORTS.PUBLISHED_AT,
      ITEM_ORDERS.DESC,
    )) as FeedContent;
  const publicFeed = loadedFeed?.publicFeed ??
    await database.getPublicJsonData(feedContent) as PublicFeed;
  const pagesResponse = await listPages(database, request, {
    limit: 100,
    statuses: ["published"],
  });
  const publicPages = pagesResponse.items.filter((page) =>
    !page.is_not_found_page
  );
  const pages = publicPages.map((page, index) => ({
    ...page,
    _loop: loopMetadata(index, publicPages.length),
  }));
  const feedItems = publicFeed.items ?? [];
  const items = feedItems.map((item, index) =>
    itemTemplateContext(item, index, feedItems.length)
  );
  const origin = new URL(request.url).origin;
  const homePageUrl = publicFeed.home_page_url ?? new URL("/", origin).toString();
  const context: Record<string, unknown> = {
    ...publicFeed,
    home_page_url: homePageUrl,
    items,
    pages,
    _site: {
      filename: input.filename,
      generated_at: new Date().toISOString(),
      has_items: items.length > 0,
      has_pages: pages.length > 0,
      json_feed: () => JSON.stringify(publicFeed),
      json_feed_url: new URL("/json/", origin).toString(),
      origin,
      rss_feed_url: new URL("/rss/", origin).toString(),
      sitemap_url: new URL("/sitemap.xml", origin).toString(),
    },
  };
  const content = renderSiteFileTemplate(input.template, context);
  const renderedError = validateRenderedSiteFile(
    content,
    input.contentType,
    {allowLargeGeneratedSitemap: input.allowLargeGeneratedSitemap},
  );
  if (renderedError) throw new Error(renderedError);
  return {content, context, feedContent};
}
