const STATUS_OPTIONS = ["published", "unlisted", "unpublished"];
const PODCAST_EPISODE_TYPE_OPTIONS = ["full", "trailer", "bonus"];
const CONTENT_TYPE_OPTIONS = ["podcast_episode", "blog_article", "photo"];
const RELATED_CONTENT_TYPE_OPTIONS = [
  "podcast_episode",
  "blog_article",
  "photo",
  "gallery",
  "landing_page",
];
const SORT_OPTIONS = ["newest_first", "oldest_first"];
const LAYOUT_OPTIONS = ["list", "grid"];

function makeFieldDef(key, kind, extra = {}) {
  return {
    key,
    kind,
    required: false,
    feedMapping: {
      source: extra.source || key,
      target: extra.target || key,
    },
    ...extra,
  };
}

const STATUS_ENUM_EXTRA = {
  label: "Status",
  options: STATUS_OPTIONS,
  valueMap: {
    published: 1,
    unpublished: 2,
    unlisted: 4,
  },
};

// Shared per-item SEO overrides (PRD_SEO_GEO 3.2). Declared once, spread into
// every content type so they auto-render in the admin editor (FormRenderer)
// and flow through the feed serializer.
function seoFieldDefs() {
  return [
    makeFieldDef("seo_title", "text", {target: "seoTitle", source: "seoTitle"}),
    makeFieldDef("seo_description", "text", {target: "seoDescription", source: "seoDescription"}),
    makeFieldDef("share_image", "image", {target: "shareImage", source: "shareImage"}),
    makeFieldDef("noindex", "boolean", {target: "noindex", source: "noindex"}),
  ];
}

function relatedContentFieldDef() {
  return makeFieldDef("related_items", "reference", {
    label: "Related items",
    allowedContentTypes: RELATED_CONTENT_TYPE_OPTIONS,
    relationType: "related_content",
    onlyPublished: true,
  });
}

const TYPE_DEFINITIONS = [
  {
    name: "podcast_episode",
    family: "record",
    rss: "itunes",
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text", {required: true}),
      makeFieldDef("url", "url", {target: "link"}),
      makeFieldDef("content_html", "richtext", {target: "description"}),
      makeFieldDef("image", "image"),
      makeFieldDef("attachment", "media", {target: "mediaFile"}),
      makeFieldDef("date_published_ms", "date", {target: "pubDateMs", label: "Publish date"}),
      makeFieldDef("guid", "text"),
      makeFieldDef("itunes:title", "text", {
        source: ["_microfeed", "itunes:title"],
        target: "itunes:title",
      }),
      makeFieldDef("itunes:block", "boolean", {
        source: ["_microfeed", "itunes:block"],
        target: "itunes:block",
      }),
      makeFieldDef("itunes:episodeType", "enum", {
        source: ["_microfeed", "itunes:episodeType"],
        target: "itunes:episodeType",
        options: PODCAST_EPISODE_TYPE_OPTIONS,
      }),
      makeFieldDef("itunes:season", "number", {
        source: ["_microfeed", "itunes:season"],
        target: "itunes:season",
        integer: true,
        min: 1,
      }),
      makeFieldDef("itunes:episode", "number", {
        source: ["_microfeed", "itunes:episode"],
        target: "itunes:episode",
        integer: true,
        min: 1,
      }),
      makeFieldDef("itunes:explicit", "boolean", {
        source: ["_microfeed", "itunes:explicit"],
        target: "itunes:explicit",
      }),
      relatedContentFieldDef(),
      ...seoFieldDefs(),
    ],
  },
  {
    name: "blog_article",
    family: "record",
    rss: "basic",
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text", {required: true}),
      makeFieldDef("content_html", "richtext", {required: true, target: "description", allowHtmlSourceMode: true}),
      makeFieldDef("image", "image"),
      makeFieldDef("excerpt", "text"),
      makeFieldDef("author", "text"),
      makeFieldDef("tags", "tags"),
      makeFieldDef("date_published_ms", "date", {target: "pubDateMs", label: "Publish date"}),
      relatedContentFieldDef(),
      ...seoFieldDefs(),
    ],
  },
  {
    name: "photo",
    family: "record",
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text"),
      makeFieldDef("image", "image", {required: true}),
      makeFieldDef("caption", "text"),
      makeFieldDef("tags", "tags"),
      makeFieldDef("taken_date", "date", {target: "pubDateMs", label: "Date taken (publish date)"}),
      relatedContentFieldDef(),
      ...seoFieldDefs(),
    ],
  },
  {
    name: "gallery",
    family: "aggregator",
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text", {required: true}),
      makeFieldDef("content_html", "richtext", {target: "description"}),
      makeFieldDef("image", "image"),
      makeFieldDef("members", "reference", {
        required: true,
        target: "members",
        allowedContentTypes: ["photo"],
        relationType: "gallery_member",
      }),
      makeFieldDef("tags", "tags"),
      makeFieldDef("date_published_ms", "date", {target: "pubDateMs", label: "Publish date"}),
      relatedContentFieldDef(),
      ...seoFieldDefs(),
    ],
  },
  {
    name: "landing_page",
    family: "aggregator",
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text", {required: true}),
      makeFieldDef("content_html", "richtext", {target: "description", allowHtmlSourceMode: true}),
      makeFieldDef("image", "image"),
      makeFieldDef("content_types", "enum", {
        multiple: true,
        options: CONTENT_TYPE_OPTIONS,
      }),
      makeFieldDef("filter_tags", "string_list"),
      makeFieldDef("sort", "enum", {
        options: SORT_OPTIONS,
      }),
      makeFieldDef("limit", "number", {integer: true, min: 1}),
      makeFieldDef("layout", "enum", {
        options: LAYOUT_OPTIONS,
      }),
      makeFieldDef("show_in_nav", "boolean", {
        target: "showInNav",
        source: "showInNav",
        label: "Show in site navigation",
      }),
      makeFieldDef("date_published_ms", "date", {target: "pubDateMs", label: "Publish date"}),
      relatedContentFieldDef(),
      ...seoFieldDefs(),
    ],
  },
  {
    name: "home_page",
    family: "page",
    singleton: true,
    slugEditable: false,
    showInTypePicker: false,
    fieldDefs: [
      makeFieldDef("status", "enum", {...STATUS_ENUM_EXTRA}),
      makeFieldDef("title", "text", {required: true, label: "Hero title"}),
      makeFieldDef("content_html", "richtext", {label: "Hero rich text", target: "description"}),
      makeFieldDef("image", "image", {label: "Hero image"}),
      makeFieldDef("show_channel_title", "boolean", {label: "Show channel title"}),
      makeFieldDef("show_channel_description", "boolean", {label: "Show channel description"}),
      makeFieldDef("show_channel_image", "boolean", {label: "Show channel image"}),
      makeFieldDef("recent_content_types", "enum", {
        multiple: true,
        options: CONTENT_TYPE_OPTIONS,
        label: "Recent content types",
      }),
      makeFieldDef("recent_limit", "number", {
        integer: true,
        min: 1,
        label: "Recent item count",
      }),
      makeFieldDef("recent_show_date", "boolean", {label: "Show date on recent items"}),
      makeFieldDef("recent_show_excerpt", "boolean", {label: "Show excerpt on recent items"}),
      makeFieldDef("recent_show_badge", "boolean", {label: "Show badge on recent items"}),
      makeFieldDef("featured_title", "text", {label: "Featured section title"}),
      makeFieldDef("featured_items", "reference", {
        label: "Featured items",
        allowedContentTypes: CONTENT_TYPE_OPTIONS,
      }),
      makeFieldDef("filtered_title", "text", {label: "Filtered section title"}),
      makeFieldDef("content_types", "enum", {
        multiple: true,
        options: CONTENT_TYPE_OPTIONS,
        label: "Filtered content types",
      }),
      makeFieldDef("filter_tags", "string_list", {label: "Filtered tags"}),
      makeFieldDef("sort", "enum", {
        options: SORT_OPTIONS,
        label: "Filtered sort order",
      }),
      makeFieldDef("limit", "number", {
        integer: true,
        min: 1,
        label: "Filtered item count",
      }),
      ...seoFieldDefs(),
    ],
  },
];

function cloneFieldDef(fieldDef) {
  return {
    ...fieldDef,
    feedMapping: {
      ...fieldDef.feedMapping,
    },
    options: fieldDef.options ? [...fieldDef.options] : undefined,
    allowedContentTypes: fieldDef.allowedContentTypes ? [...fieldDef.allowedContentTypes] : undefined,
    valueMap: fieldDef.valueMap ? {...fieldDef.valueMap} : undefined,
  };
}

function cloneTypeDef(typeDef) {
  return {
    ...typeDef,
    fieldDefs: typeDef.fieldDefs.map(cloneFieldDef),
  };
}

export function getType(typeName) {
  const typeDef = TYPE_DEFINITIONS.find((candidate) => candidate.name === typeName);
  if (!typeDef) {
    throw new Error(`Unknown content type: ${typeName}`);
  }
  return cloneTypeDef(typeDef);
}

export function listTypes() {
  return TYPE_DEFINITIONS.map(cloneTypeDef);
}

export function getFieldDefs(typeName) {
  return getType(typeName).fieldDefs;
}

export function isAggregator(typeName) {
  return getType(typeName).family === "aggregator";
}

/**
 * Returns the RSS flavor a content type should be rendered with:
 * "itunes" (podcast RSS with iTunes tags + enclosure), "basic" (plain
 * RSS 2.0 item), or null when the type has no RSS mapping at all
 * (e.g. photo, gallery, landing_page).
 */
export function getRssKind(typeName) {
  const typeDef = getType(typeName);
  return typeDef.rss || null;
}

export {TYPE_DEFINITIONS};

export default {
  getType,
  listTypes,
  getFieldDefs,
  isAggregator,
  getRssKind,
  TYPE_DEFINITIONS,
};
