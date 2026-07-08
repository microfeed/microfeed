import React from "react";
import ItemRepo from "../edge-src/models/ItemRepo";
import FeedDb from "../edge-src/models/FeedDb";
import {serializeItemForFeed} from "../edge-src/models/FeedItemSerializer";
import {listTypes} from "../edge-src/registry/ContentTypeRegistry";
import HomePage from "../edge-src/web/HomePage";
import {getPublicNavLinks} from "../edge-src/web/publicNavTypes";
import {serializeChannelForWeb} from "../edge-src/web/publicChannel";
import {renderReactToHtml} from "../edge-src/common/PageUtils";
import {siteSeo} from "../edge-src/web/seo/buildSeo";
import {STATUSES, SETTINGS_CATEGORIES} from "../common-src/Constants";

const HOME_ITEMS_LIMIT = 20;
const VISIBLE_HOME_PAGE_STATUSES = [STATUSES.PUBLISHED, STATUSES.UNLISTED];

function recordTypeNames() {
  return listTypes().filter((type) => type.family === "record").map((type) => type.name);
}

async function loadHomePage(itemRepo, publicBucketUrl) {
  const response = await itemRepo.list({
    queryKwargs: {
      content_type: "home_page",
      status__in: VISIBLE_HOME_PAGE_STATUSES,
    },
    orderBy: ["created_at asc", "id"],
    limit: 1,
  });
  const row = response.results[0] || null;
  return row ? serializeItemForFeed(row, {publicBucketUrl}) : null;
}

async function loadItemsByIds(itemRepo, itemIds, publicBucketUrl) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return [];
  }

  const response = await itemRepo.list({
    queryKwargs: {
      id__in: itemIds,
      status: STATUSES.PUBLISHED,
    },
  });
  const rowsById = new Map(response.results.map((row) => [row.id, row]));

  return itemIds
    .map((id) => rowsById.get(id))
    .filter((row) => row !== undefined)
    .map((row) => serializeItemForFeed(row, {publicBucketUrl}));
}

export async function onRequestGet({env, request}) {
  const feedDb = new FeedDb(env, request);
  const content = await feedDb.getContent();
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || "";

  const itemRepo = new ItemRepo(env.FEED_DB);
  const response = await itemRepo.list({
    queryKwargs: {
      content_type__in: recordTypeNames(),
      status: STATUSES.PUBLISHED,
    },
    orderBy: ["pub_date desc", "id"],
    limit: HOME_ITEMS_LIMIT,
  });

  const items = response.results.map((row) => serializeItemForFeed(row, {publicBucketUrl}));
  const navTypes = await getPublicNavLinks(itemRepo);
  const channel = serializeChannelForWeb(content.channel, publicBucketUrl);
  const homePage = await loadHomePage(itemRepo, publicBucketUrl);
  let recentItems = items;
  let featuredItems = [];
  let filteredItems = [];

  if (homePage) {
    const recentContentTypes = Array.isArray(homePage.recent_content_types) && homePage.recent_content_types.length > 0
      ? homePage.recent_content_types
      : recordTypeNames();
    const recentLimit = Number.isFinite(homePage.recent_limit) && homePage.recent_limit > 0
      ? homePage.recent_limit
      : HOME_ITEMS_LIMIT;

    const recentResponse = await itemRepo.list({
      queryKwargs: {
        content_type__in: recentContentTypes,
        status: STATUSES.PUBLISHED,
      },
      orderBy: ["pub_date desc", "id"],
      limit: recentLimit,
    });
    recentItems = recentResponse.results.map((row) => serializeItemForFeed(row, {publicBucketUrl}));

    featuredItems = await loadItemsByIds(itemRepo, homePage.featured_items, publicBucketUrl);

    const hasFilteredConfig = Boolean(
      homePage.filtered_title
        || (Array.isArray(homePage.content_types) && homePage.content_types.length > 0)
        || (Array.isArray(homePage.filter_tags) && homePage.filter_tags.length > 0)
        || homePage.sort
        || homePage.limit,
    );

    if (hasFilteredConfig) {
      const resolved = await feedDb.aggregationResolver.resolveFilter(homePage, {
        statuses: [STATUSES.PUBLISHED],
      });
      filteredItems = resolved.map((row) => serializeItemForFeed(row, {publicBucketUrl}));
    }
  }

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/`;
  const seoSettings = (content.settings && content.settings[SETTINGS_CATEGORIES.SEO]) || {};
  const seo = siteSeo({channel, homePage, seoSettings, publicBucketUrl, canonicalUrl});

  const html = renderReactToHtml(
    <HomePage
      channel={channel}
      items={items}
      recentItems={recentItems}
      homePage={homePage}
      featuredItems={featuredItems}
      filteredItems={filteredItems}
      canonicalUrl={canonicalUrl}
      navTypes={navTypes}
      seo={seo}
    />,
  );
  return new Response(html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
}
