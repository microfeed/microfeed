import ItemRepo from "../models/ItemRepo";
import FeedDb from "../models/FeedDb";
import {serializeItemForFeed} from "../models/FeedItemSerializer";
import {getPublicNavLinks} from "./publicNavTypes";
import {serializeChannelForWeb} from "./publicChannel";
import {listingSeo} from "./seo/buildSeo";
import {itemPublicUrl} from "./itemPublicUrl";
import {STATUSES, DEFAULT_ITEMS_PER_PAGE, SETTINGS_CATEGORIES} from "../../common-src/Constants";

/**
 * Resolves a public per-type listing page (/blog/, /photo/, /i/): paginates
 * PUBLISHED items of one content_type via ItemRepo.listPaginated (cursor
 * pagination), serializes them for the public shape, and computes the
 * shared nav-types list. Mirrors resolveRecordPage/resolveAggregatorPage so
 * route handlers stay thin. `typeLabel` (e.g. "Blog") is used to build the
 * page's SEO title/JSON-LD - it is caller-supplied because the label table
 * lives with the route handlers, not the resolver.
 */
export async function resolveTypeListingPage(env, request, contentType, typeLabel = contentType) {
  const itemRepo = new ItemRepo(env.FEED_DB);
  const feedDb = new FeedDb(env, request);
  const content = await feedDb.getContent();
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || "";
  const seoSettings = (content.settings && content.settings[SETTINGS_CATEGORIES.SEO]) || {};

  const urlObject = new URL(request.url);
  const nextCursorParam = urlObject.searchParams.get("next_cursor");
  const prevCursorParam = urlObject.searchParams.get("prev_cursor");

  const page = await itemRepo.listPaginated({
    queryKwargs: {
      content_type: contentType,
      status: STATUSES.PUBLISHED,
    },
    limit: webGlobalSettings.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
    nextCursor: nextCursorParam ? parseInt(nextCursorParam, 10) : undefined,
    prevCursor: prevCursorParam ? parseInt(prevCursorParam, 10) : undefined,
  });

  const items = page.results.map((row) => serializeItemForFeed(row, {publicBucketUrl}));
  const navTypes = await getPublicNavLinks(itemRepo);
  const channel = serializeChannelForWeb(content.channel, publicBucketUrl);

  const canonicalUrl = `${urlObject.origin}${itemPublicUrl(contentType, "")}`;
  const seo = listingSeo({typeLabel, items, channel, seoSettings, publicBucketUrl, canonicalUrl});

  return {
    items,
    nextCursor: page.items_next_cursor,
    prevCursor: page.items_prev_cursor,
    navTypes,
    channel,
    seo,
  };
}

export default resolveTypeListingPage;
