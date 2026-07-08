import ItemRepo from "../models/ItemRepo";
import FeedDb from "../models/FeedDb";
import {serializeItemForFeed} from "../models/FeedItemSerializer";
import {getPublicNavLinks} from "./publicNavTypes";
import {serializeChannelForWeb} from "./publicChannel";
import {recordSeo} from "./seo/buildSeo";
import {itemPublicUrl} from "./itemPublicUrl";
import {STATUSES, SETTINGS_CATEGORIES} from "../../common-src/Constants";

const VISIBLE_STATUSES = new Set([STATUSES.PUBLISHED, STATUSES.UNLISTED]);

/**
 * Resolves a public record-type page by (content_type, slug): looks the row
 * up directly via ItemRepo (FeedDb's content-fetch is list/paginate-shaped
 * and doesn't resolve a single row by slug), honours PUBLISHED/UNLISTED
 * visibility, and serializes the row into the clean public item shape
 * templates render from. Returns null when the item is missing or hidden
 * (UNPUBLISHED/DELETED) — callers should respond 404 in that case.
 */
export async function resolveRecordPage(env, request, contentType, slug) {
  const itemRepo = new ItemRepo(env.FEED_DB);
  const row = await itemRepo.getByTypeAndSlug(contentType, slug);
  if (!row || !VISIBLE_STATUSES.has(row.status)) {
    return null;
  }

  const feedDb = new FeedDb(env, request);
  const content = await feedDb.getContent();
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || "";
  const seoSettings = (content.settings && content.settings[SETTINGS_CATEGORIES.SEO]) || {};

  const item = serializeItemForFeed(row, {publicBucketUrl});
  const navTypes = await getPublicNavLinks(itemRepo);
  const channel = serializeChannelForWeb(content.channel, publicBucketUrl);
  const relatedRows = await feedDb.aggregationResolver.resolveRelated(row, {
    statuses: [STATUSES.PUBLISHED],
  });
  const relatedItems = relatedRows.map((relatedRow) => serializeItemForFeed(relatedRow, {publicBucketUrl}));

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}${itemPublicUrl(contentType, slug)}/`;
  const seo = recordSeo({item, contentType, channel, seoSettings, publicBucketUrl, canonicalUrl});

  return {row, item, relatedItems, content, publicBucketUrl, channel, navTypes, seo};
}

export default resolveRecordPage;
