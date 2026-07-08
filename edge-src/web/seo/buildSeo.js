import {htmlMetaDescription, urlJoinWithRelative} from "../../../common-src/StringUtils";
import {msToRFC3339} from "../../../common-src/TimeUtils";
import {STATUSES} from "../../../common-src/Constants";
import {itemPublicUrl} from "../itemPublicUrl";

// Pure SEO/GEO builders (PRD_SEO_GEO.md Phase 2 / §4.1). Every function here
// takes plain serialized data (channel, item, settings) and returns a
// PageSeo object: {title, description, canonicalUrl, ogType, image,
// siteName, twitterHandle, keywords, noindex, publishedTime, modifiedTime,
// author, section, tags, jsonLd}. jsonLd is a plain JS object/array that
// callers JSON.stringify (see JsonLd.jsx) - never build markup here.

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * Single description-derivation helper reused by the SEO layer AND (Phase 3)
 * the llms.txt generator, so both surfaces produce identical descriptions
 * for the same page. Precedence: explicit override > excerpt > caption >
 * meta-stripped content_html > fallback. HTML is always stripped/truncated
 * via htmlMetaDescription so no raw user HTML ever reaches a description
 * field (meta tag or JSON-LD string).
 */
export function pageDescription({seoDescription, excerpt, caption, contentHtml, fallback = ""} = {}) {
  if (seoDescription) {
    return seoDescription;
  }
  if (excerpt) {
    return excerpt;
  }
  if (caption) {
    return caption;
  }
  if (contentHtml) {
    return htmlMetaDescription(contentHtml, true);
  }
  return fallback || "";
}

function splitKeyTerms(keyTerms) {
  if (!keyTerms) {
    return [];
  }
  return keyTerms
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

function mergeKeywords(itemTags, keyTerms) {
  const merged = [...(itemTags || []), ...splitKeyTerms(keyTerms)];
  return Array.from(new Set(merged.filter(Boolean)));
}

function absoluteImage(imagePath, publicBucketUrl) {
  if (!imagePath) {
    return null;
  }
  // Already-absolute URLs pass through urlJoinWithRelative untouched when a
  // publicBucketUrl is set; when the path is bucket-relative this joins it
  // the same way FeedItemSerializer/serializeChannelForWeb do.
  if (/^https?:\/\//.test(imagePath)) {
    return imagePath;
  }
  return urlJoinWithRelative(publicBucketUrl, imagePath);
}

function resolveSettingsImage(image, publicBucketUrl) {
  if (!image) {
    return null;
  }
  const url = typeof image === "string" ? image : image.url;
  return absoluteImage(url, publicBucketUrl);
}

function publisherNode(seoSettings = {}, channel = {}, publicBucketUrl = "") {
  const publisherType = seoSettings.publisherType === "Person" ? "Person" : "Organization";
  const name = seoSettings.publisherName || channel.title || "";
  const node = {
    "@type": publisherType,
    name,
  };
  const logoUrl = resolveSettingsImage(seoSettings.publisherLogo, publicBucketUrl);
  if (logoUrl) {
    node.logo = {"@type": "ImageObject", url: logoUrl};
  }
  if (Array.isArray(seoSettings.sameAs) && seoSettings.sameAs.length > 0) {
    node.sameAs = seoSettings.sameAs;
  }
  return node;
}

function authorNode(authorName, publisher) {
  if (!authorName) {
    return publisher;
  }
  return {"@type": "Person", name: authorName};
}

function breadcrumbList(entries) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: entries.map(({name, url}, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: url,
    })),
  };
}

// Returns the PageSeo fields carrying structured data for a detail page: the
// primary entity as a clean top-level JSON-LD object (so consumers can read
// seo.jsonLd["@type"] directly) plus the BreadcrumbList as a separate node.
// The two are emitted as two independent <script type="application/ld+json">
// blocks (JsonLd.jsx) - the Google-recommended way to express multiple
// entities, avoiding a redundant @graph that also duplicates the main node.
function withBreadcrumb(mainNode, breadcrumbEntries) {
  return {
    jsonLd: {
      "@context": SCHEMA_CONTEXT,
      ...mainNode,
    },
    breadcrumb: breadcrumbList(breadcrumbEntries),
  };
}

// Public items carry status as the human-readable string produced by
// FeedItemSerializer's enum toPublic mapping ("published"/"unpublished"/
// "unlisted"), not the internal numeric STATUSES.* value - accept both so
// this stays correct whether callers pass a serialized public item or a raw
// row/status constant (as some buildSeo unit tests do).
const UNLISTED_STATUS_VALUES = new Set(["unlisted", STATUSES.UNLISTED]);

function isNoindex(item = {}) {
  return item.noindex === true || UNLISTED_STATUS_VALUES.has(item.status);
}

function siteOrigin(canonicalUrl) {
  try {
    return new URL(canonicalUrl).origin;
  } catch (e) {
    return "";
  }
}

// OG/Twitter/JSON-LD image URLs must be absolute - social + AI crawlers
// reject relative ones. absoluteImage() only resolves bucket-relative paths
// via publicBucketUrl; a root-relative path (the default channel image
// "/assets/...", or any image when publicBucketUrl is unset) stays relative.
// This resolves that remaining relative case against the page origin, the
// same way sitemap.xml does.
function ensureAbsolute(url, origin) {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  if (origin && url.startsWith("/")) {
    return `${origin}${url}`;
  }
  return url;
}

/**
 * Home-page SEO: WebSite node + publisher (Organization|Person).
 */
export function siteSeo({
  channel = {},
  homePage = null,
  seoSettings = {},
  publicBucketUrl = "",
  canonicalUrl = "",
} = {}) {
  const siteName = seoSettings.siteName || channel.title || homePage?.title || "";
  const description = pageDescription({
    seoDescription: homePage?.seo_description,
    contentHtml: homePage?.content_html,
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(
    resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
      || resolveSettingsImage(homePage?.share_image, publicBucketUrl)
      || resolveSettingsImage(homePage?.image, publicBucketUrl)
      || channel.image
      || null,
    siteOrigin(canonicalUrl),
  );
  const keywords = mergeKeywords([], seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);
  const noindex = homePage?.noindex === true || homePage?.status === "unlisted" || homePage?.status === STATUSES.UNLISTED;

  const jsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: siteName,
    url: canonicalUrl || channel.link || "",
    description,
    publisher,
  };
  if (keywords.length > 0) {
    jsonLd.keywords = keywords.join(", ");
  }

  return {
    title: siteName,
    description,
    canonicalUrl,
    ogType: "website",
    image,
    siteName,
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex,
    publishedTime: null,
    modifiedTime: null,
    author: null,
    section: null,
    tags: [],
    jsonLd,
  };
}

const RECORD_TYPE_LABELS = {
  blog_article: "Blog",
  photo: "Photos",
  podcast_episode: "Podcast",
};

function recordBreadcrumbEntries({contentType, item, channel, canonicalUrl}) {
  const origin = siteOrigin(canonicalUrl);
  const sectionLabel = RECORD_TYPE_LABELS[contentType] || contentType;
  return [
    {name: channel.title || "Home", url: origin ? `${origin}/` : "/"},
    {name: sectionLabel, url: origin ? `${origin}${itemPublicUrl(contentType, "")}` : itemPublicUrl(contentType, "")},
    {name: item.title || item.caption || item.slug, url: canonicalUrl},
  ];
}

function buildBlogPostingSeo({item, channel, seoSettings, publicBucketUrl, canonicalUrl}) {
  const title = item.seoTitle || item.title || seoSettings.siteName || channel.title || "";
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    caption: item.caption,
    contentHtml: item.content_html,
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(
    absoluteImage(item.shareImage, publicBucketUrl)
    || absoluteImage(item.image, publicBucketUrl)
    || resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
    || channel.image
    || null,
    siteOrigin(canonicalUrl),
  );
  const publishedTime = item.date_published_ms !== undefined && item.date_published_ms !== null
    ? msToRFC3339(item.date_published_ms)
    : null;
  const keywords = mergeKeywords(item.tags, seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);

  const mainNode = {
    "@type": "BlogPosting",
    headline: title,
    description,
    image,
    datePublished: publishedTime,
    author: authorNode(item.author, publisher),
    publisher,
    mainEntityOfPage: {"@type": "WebPage", "@id": canonicalUrl},
  };
  if (keywords.length > 0) {
    mainNode.keywords = keywords.join(", ");
  }

  return {
    title,
    description,
    canonicalUrl,
    ogType: "article",
    image,
    siteName: seoSettings.siteName || channel.title || "",
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: isNoindex(item),
    publishedTime,
    modifiedTime: null,
    author: item.author || null,
    section: RECORD_TYPE_LABELS.blog_article,
    tags: item.tags || [],
    ...withBreadcrumb(mainNode, recordBreadcrumbEntries({contentType: "blog_article", item, channel, canonicalUrl})),
  };
}

function buildPodcastEpisodeSeo({item, channel, seoSettings, publicBucketUrl, canonicalUrl}) {
  const title = item.seoTitle || item.title || seoSettings.siteName || channel.title || "";
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    caption: item.caption,
    contentHtml: item.content_html,
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(
    absoluteImage(item.shareImage, publicBucketUrl)
    || absoluteImage(item.image, publicBucketUrl)
    || resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
    || channel.image
    || null,
    siteOrigin(canonicalUrl),
  );
  const publishedTime = item.date_published_ms !== undefined && item.date_published_ms !== null
    ? msToRFC3339(item.date_published_ms)
    : null;
  const keywords = mergeKeywords(item.tags, seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);
  const siteName = seoSettings.siteName || channel.title || "";

  const mainNode = {
    "@type": "PodcastEpisode",
    name: title,
    description,
    image,
    datePublished: publishedTime,
    author: authorNode(item.author, publisher),
    publisher,
    partOfSeries: {
      "@type": "PodcastSeries",
      name: siteName,
      url: siteOrigin(canonicalUrl) ? `${siteOrigin(canonicalUrl)}/` : undefined,
    },
  };
  if (item.attachment && item.attachment.url) {
    mainNode.associatedMedia = {
      "@type": "AudioObject",
      contentUrl: item.attachment.url,
      encodingFormat: item.attachment.mime_type || undefined,
    };
  }
  if (keywords.length > 0) {
    mainNode.keywords = keywords.join(", ");
  }

  return {
    title,
    description,
    canonicalUrl,
    ogType: "article",
    image,
    siteName,
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: isNoindex(item),
    publishedTime,
    modifiedTime: null,
    author: item.author || null,
    section: RECORD_TYPE_LABELS.podcast_episode,
    tags: item.tags || [],
    ...withBreadcrumb(mainNode, recordBreadcrumbEntries({contentType: "podcast_episode", item, channel, canonicalUrl})),
  };
}

function buildPhotoSeo({item, channel, seoSettings, publicBucketUrl, canonicalUrl}) {
  const title = item.seoTitle || item.title || item.caption || seoSettings.siteName || channel.title || "";
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    caption: item.caption,
    contentHtml: item.content_html,
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(
    absoluteImage(item.shareImage, publicBucketUrl)
    || absoluteImage(item.image, publicBucketUrl)
    || resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
    || channel.image
    || null,
    siteOrigin(canonicalUrl),
  );
  const takenMs = item.taken_date !== undefined && item.taken_date !== null ? item.taken_date : item.date_published_ms;
  const publishedTime = takenMs !== undefined && takenMs !== null ? msToRFC3339(takenMs) : null;
  const keywords = mergeKeywords(item.tags, seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);

  const mainNode = {
    "@type": "ImageObject",
    "@additionalType": "Photograph",
    name: title,
    caption: item.caption || description,
    description,
    contentUrl: image,
    datePublished: publishedTime,
    author: authorNode(item.author, publisher),
    publisher,
  };
  if (keywords.length > 0) {
    mainNode.keywords = keywords.join(", ");
  }

  return {
    title,
    description,
    canonicalUrl,
    ogType: "article",
    image,
    siteName: seoSettings.siteName || channel.title || "",
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: isNoindex(item),
    publishedTime,
    modifiedTime: null,
    author: item.author || null,
    section: RECORD_TYPE_LABELS.photo,
    tags: item.tags || [],
    ...withBreadcrumb(mainNode, recordBreadcrumbEntries({contentType: "photo", item, channel, canonicalUrl})),
  };
}

const RECORD_BUILDERS = {
  blog_article: buildBlogPostingSeo,
  podcast_episode: buildPodcastEpisodeSeo,
  photo: buildPhotoSeo,
};

/**
 * Per-item record-page SEO (blog_article/podcast_episode/photo). Dispatches
 * to the type-specific JSON-LD builder; the returned PageSeo shape is
 * identical across types so MetaTags/JsonLd/RecordPageLayout stay
 * type-agnostic.
 */
export function recordSeo({item = {}, contentType, channel = {}, seoSettings = {}, publicBucketUrl = "", canonicalUrl = ""} = {}) {
  const builder = RECORD_BUILDERS[contentType];
  if (!builder) {
    throw new Error(`recordSeo: unsupported content type "${contentType}"`);
  }
  return builder({item, channel, seoSettings, publicBucketUrl, canonicalUrl});
}

function buildGallerySeo({item, members, channel, seoSettings, publicBucketUrl, canonicalUrl}) {
  const title = item.seoTitle || item.title || seoSettings.siteName || channel.title || "";
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    contentHtml: item.content_html,
    fallback: channel.description || "",
  });
  const memberImages = (members || [])
    .filter((member) => member.image)
    .map((member) => ({
      "@type": "ImageObject",
      contentUrl: absoluteImage(member.image, publicBucketUrl),
      name: member.title || member.caption || undefined,
      caption: member.caption || undefined,
    }));
  const image = ensureAbsolute(
    absoluteImage(item.shareImage, publicBucketUrl)
    || absoluteImage(item.image, publicBucketUrl)
    || (memberImages[0] && memberImages[0].contentUrl)
    || resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
    || channel.image
    || null,
    siteOrigin(canonicalUrl),
  );
  const keywords = mergeKeywords(item.tags, seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);

  const mainNode = {
    "@type": "ImageGallery",
    name: title,
    description,
    image,
    associatedMedia: memberImages,
    hasPart: memberImages,
    publisher,
  };
  if (keywords.length > 0) {
    mainNode.keywords = keywords.join(", ");
  }

  return {
    title,
    description,
    canonicalUrl,
    ogType: "website",
    image,
    siteName: seoSettings.siteName || channel.title || "",
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: isNoindex(item),
    publishedTime: item.date_published_ms !== undefined && item.date_published_ms !== null ? msToRFC3339(item.date_published_ms) : null,
    modifiedTime: null,
    author: null,
    section: "Galleries",
    tags: item.tags || [],
    ...withBreadcrumb(mainNode, [
      {name: channel.title || "Home", url: siteOrigin(canonicalUrl) ? `${siteOrigin(canonicalUrl)}/` : "/"},
      {name: "Galleries", url: siteOrigin(canonicalUrl) ? `${siteOrigin(canonicalUrl)}${itemPublicUrl("gallery", "")}` : itemPublicUrl("gallery", "")},
      {name: title, url: canonicalUrl},
    ]),
  };
}

function buildLandingPageSeo({item, members, channel, seoSettings, publicBucketUrl, canonicalUrl}) {
  const title = item.seoTitle || item.title || seoSettings.siteName || channel.title || "";
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    contentHtml: item.content_html,
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(
    absoluteImage(item.shareImage, publicBucketUrl)
    || absoluteImage(item.image, publicBucketUrl)
    || resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl)
    || channel.image
    || null,
    siteOrigin(canonicalUrl),
  );
  const keywords = mergeKeywords(item.tags, seoSettings.keyTerms);
  const publisher = publisherNode(seoSettings, channel, publicBucketUrl);

  const hasPart = (members || []).map((member) => ({
    "@type": "CreativeWork",
    name: member.title || member.caption || member.slug,
    url: siteOrigin(canonicalUrl)
      ? `${siteOrigin(canonicalUrl)}${itemPublicUrl(member.content_type, member.slug)}`
      : itemPublicUrl(member.content_type, member.slug),
  }));

  const mainNode = {
    "@type": "CollectionPage",
    name: title,
    description,
    image,
    hasPart,
    publisher,
  };
  if (keywords.length > 0) {
    mainNode.keywords = keywords.join(", ");
  }

  return {
    title,
    description,
    canonicalUrl,
    ogType: "website",
    image,
    siteName: seoSettings.siteName || channel.title || "",
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: isNoindex(item),
    publishedTime: null,
    modifiedTime: null,
    author: null,
    section: null,
    tags: item.tags || [],
    ...withBreadcrumb(mainNode, [
      {name: channel.title || "Home", url: siteOrigin(canonicalUrl) ? `${siteOrigin(canonicalUrl)}/` : "/"},
      {name: title, url: canonicalUrl},
    ]),
  };
}

const AGGREGATOR_BUILDERS = {
  gallery: buildGallerySeo,
  landing_page: buildLandingPageSeo,
};

/**
 * Aggregator-page SEO (gallery/landing_page). `members` are the already
 * resolved+serialized child items (AggregationResolver output).
 */
export function aggregatorSeo({item = {}, contentType, members = [], channel = {}, seoSettings = {}, publicBucketUrl = "", canonicalUrl = ""} = {}) {
  const builder = AGGREGATOR_BUILDERS[contentType];
  if (!builder) {
    throw new Error(`aggregatorSeo: unsupported content type "${contentType}"`);
  }
  return builder({item, members, channel, seoSettings, publicBucketUrl, canonicalUrl});
}

/**
 * Per-type listing page SEO (/blog/, /photo/, /i/, /gallery/): a
 * CollectionPage wrapping an ItemList of the listed items.
 */
export function listingSeo({typeLabel, items = [], channel = {}, seoSettings = {}, publicBucketUrl = "", canonicalUrl = ""} = {}) {
  const siteName = seoSettings.siteName || channel.title || "";
  const title = siteName ? `${typeLabel} - ${siteName}` : typeLabel;
  const description = pageDescription({
    fallback: channel.description || "",
  });
  const image = ensureAbsolute(resolveSettingsImage(seoSettings.defaultShareImage, publicBucketUrl) || channel.image || null, siteOrigin(canonicalUrl));
  const keywords = mergeKeywords([], seoSettings.keyTerms);

  const itemListElement = items.map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: entry.title || entry.caption || entry.slug,
    url: siteOrigin(canonicalUrl)
      ? `${siteOrigin(canonicalUrl)}${itemPublicUrl(entry.content_type, entry.slug)}`
      : itemPublicUrl(entry.content_type, entry.slug),
  }));

  const jsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonicalUrl,
    mainEntity: {
      "@type": "ItemList",
      itemListElement,
    },
  };

  return {
    title,
    description,
    canonicalUrl,
    ogType: "website",
    image,
    siteName,
    twitterHandle: seoSettings.twitterHandle || null,
    keywords,
    noindex: false,
    publishedTime: null,
    modifiedTime: null,
    author: null,
    section: typeLabel,
    tags: [],
    jsonLd,
  };
}

export default {
  pageDescription,
  siteSeo,
  recordSeo,
  aggregatorSeo,
  listingSeo,
};
