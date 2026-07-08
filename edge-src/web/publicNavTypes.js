import {listTypes} from "../registry/ContentTypeRegistry";
import {serializeItemForFeed} from "../models/FeedItemSerializer";
import {STATUSES} from "../../common-src/Constants";
import {itemPublicUrl} from "./itemPublicUrl";

// Single source of truth for the record-type/gallery -> nav label mapping,
// so the nav bar, home page, and listing routes never duplicate this table.
const NAV_TYPE_LABELS = {
  blog_article: "Blog",
  photo: "Photos",
  podcast_episode: "Podcast",
};

const GALLERY_NAV_LABEL = "Galleries";

// Landing pages are few; a sane upper bound keeps the in-JS show_in_nav
// filter (below) cheap without needing a dedicated query flag.
const LANDING_PAGE_NAV_FETCH_LIMIT = 50;

function recordTypeNames() {
  return listTypes().filter((type) => type.family === "record").map((type) => type.name);
}

/**
 * Returns the record-type nav entries ({name, label, href}) for types that
 * currently have at least one PUBLISHED item. Every public route should call
 * this to populate PublicNav so the "has content" computation lives in one
 * place.
 */
export async function getPublicNavTypes(itemRepo) {
  const navTypes = [];

  for (const typeName of recordTypeNames()) {
    const response = await itemRepo.list({
      queryKwargs: {
        content_type: typeName,
        status: STATUSES.PUBLISHED,
      },
      limit: 1,
    });

    if (response.results.length > 0) {
      navTypes.push({
        name: typeName,
        label: NAV_TYPE_LABELS[typeName] || typeName,
        href: itemPublicUrl(typeName, ""),
      });
    }
  }

  return navTypes;
}

/**
 * Returns a nav entry for "Galleries" (-> /gallery/) when at least one
 * PUBLISHED gallery exists, or null otherwise.
 */
async function getGalleryNavLink(itemRepo) {
  const response = await itemRepo.list({
    queryKwargs: {
      content_type: "gallery",
      status: STATUSES.PUBLISHED,
    },
    limit: 1,
  });

  if (response.results.length === 0) {
    return null;
  }

  return {
    name: "gallery",
    label: GALLERY_NAV_LABEL,
    href: itemPublicUrl("gallery", ""),
  };
}

/**
 * Returns nav entries for published landing_page items flagged
 * show_in_nav. show_in_nav lives inside the item's data JSON (not a table
 * column), so QueryBuilder can't filter on it — this fetches published
 * landing pages and filters/serializes in JS instead.
 */
async function getLandingPageNavLinks(itemRepo) {
  const response = await itemRepo.list({
    queryKwargs: {
      content_type: "landing_page",
      status: STATUSES.PUBLISHED,
    },
    orderBy: ["pub_date desc", "id"],
    limit: LANDING_PAGE_NAV_FETCH_LIMIT,
  });

  return response.results
    .map((row) => serializeItemForFeed(row))
    .filter((item) => item.showInNav === true)
    .map((item) => ({
      name: `landing:${item.slug}`,
      label: item.title,
      href: itemPublicUrl("landing_page", item.slug),
    }));
}

/**
 * Returns the full ordered public nav-link list: record-type links, then
 * the Galleries link (if any published gallery exists), then flagged
 * published landing-page links. Every public route should call this (in
 * place of getPublicNavTypes) so galleries + landing links appear
 * everywhere consistently.
 */
export async function getPublicNavLinks(itemRepo) {
  const recordTypeLinks = await getPublicNavTypes(itemRepo);
  const galleryLink = await getGalleryNavLink(itemRepo);
  const landingPageLinks = await getLandingPageNavLinks(itemRepo);

  return [
    ...recordTypeLinks,
    ...(galleryLink ? [galleryLink] : []),
    ...landingPageLinks,
  ];
}

export {NAV_TYPE_LABELS, GALLERY_NAV_LABEL};

export default {
  getPublicNavTypes,
  getPublicNavLinks,
  NAV_TYPE_LABELS,
  GALLERY_NAV_LABEL,
};
