// Maps a content_type to its public web path prefix. Used to build an
// item's public URL consistently across record pages (6.3a) and the
// aggregator/home pages (6.4) without duplicating the type->route table.
const TYPE_PATH_PREFIXES = {
  podcast_episode: "/i/",
  blog_article: "/blog/",
  photo: "/photo/",
  gallery: "/gallery/",
  landing_page: "/",
};

/**
 * Builds the public path for an item given its content_type and slug.
 * Falls back to a root-relative slug path for unknown types.
 */
export function itemPublicUrl(contentType, slug) {
  if (contentType === "home_page") {
    return "/";
  }
  const prefix = TYPE_PATH_PREFIXES[contentType];
  if (prefix === undefined) {
    return `/${slug}`;
  }
  return `${prefix}${slug}`;
}

export default itemPublicUrl;
