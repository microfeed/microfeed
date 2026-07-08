import ItemRepo from "../edge-src/models/ItemRepo";
import FeedDb from "../edge-src/models/FeedDb";
import {serializeItemForFeed} from "../edge-src/models/FeedItemSerializer";
import {itemPublicUrl} from "../edge-src/web/itemPublicUrl";
import {escapeHtml} from "../common-src/StringUtils";
import {STATUSES} from "../common-src/Constants";

// PRD_SEO_GEO.md Phase 3 (§5): rewritten to build directly from ItemRepo +
// itemPublicUrl instead of the old FeedDb/web_url-based SitemapResponseBuilder,
// so URLs match the new /blog/ /photo/ /i/ /gallery/ scheme (SitemapResponseBuilder
// was entangled with the old feed shape - see PageUtils.js). Excludes
// noindex + non-PUBLISHED (unlisted/unpublished/deleted) items.

// Content types that get their own listing root (/blog/, /photo/, /i/,
// /gallery/) when at least one published item of that type exists.
// landing_page has no listing root - individual pages are linked from nav.
const LISTING_ROOT_TYPES = ["blog_article", "photo", "podcast_episode", "gallery"];

// All content types that produce a real public detail page and therefore
// belong in the sitemap.
const SITEMAP_ITEM_TYPES = ["blog_article", "photo", "podcast_episode", "gallery", "landing_page"];

function isIndexable(item) {
  return item.noindex !== true && item.status === "published";
}

// Item images are bucket-relative when no publicBucketUrl is configured
// (serializeItemForFeed still returns a root-relative "/path"); a sitemap
// needs an absolute URL regardless, so resolve any remaining relative path
// against the request origin.
function absoluteImageUrl(image, origin) {
  if (!image) {
    return null;
  }
  if (/^https?:\/\//.test(image)) {
    return image;
  }
  return `${origin}${image.startsWith("/") ? "" : "/"}${image}`;
}

function urlEntry({loc, lastmodMs, image}) {
  let xml = `<url><loc>${escapeHtml(loc)}</loc>`;
  if (lastmodMs !== undefined && lastmodMs !== null && !Number.isNaN(lastmodMs)) {
    xml += `<lastmod>${new Date(lastmodMs).toISOString()}</lastmod>`;
  }
  if (image) {
    xml += `<image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>`;
  }
  xml += "</url>";
  return xml;
}

export async function onRequestGet({env, request}) {
  const itemRepo = new ItemRepo(env.FEED_DB);
  const feedDb = new FeedDb(env, request);
  const content = await feedDb.getContent();
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || "";

  const {origin} = new URL(request.url);

  const urls = [];
  urls.push(urlEntry({loc: `${origin}/`}));

  for (const contentType of SITEMAP_ITEM_TYPES) {
    const response = await itemRepo.list({
      queryKwargs: {
        content_type: contentType,
        status: STATUSES.PUBLISHED,
      },
      orderBy: ["pub_date desc", "id"],
    });

    const items = response.results
      .map((row) => serializeItemForFeed(row, {publicBucketUrl}))
      .filter(isIndexable);

    if (LISTING_ROOT_TYPES.includes(contentType) && items.length > 0) {
      urls.push(urlEntry({loc: `${origin}${itemPublicUrl(contentType, "")}`}));
    }

    items.forEach((item) => {
      urls.push(urlEntry({
        loc: `${origin}${itemPublicUrl(contentType, item.slug)}/`,
        lastmodMs: item.date_published_ms,
        image: absoluteImageUrl(item.image, origin),
      }));
    });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';
  xml += urls.join("");
  xml += "</urlset>";

  return new Response(xml, {
    headers: {"content-type": "application/xml; charset=utf-8"},
  });
}
