import * as z from "zod";

export const THEME_FORMAT_VERSION_V1 = 1 as const;
export const THEME_FORMAT_VERSION_V2 = 2 as const;
export const THEME_FORMAT_VERSION = THEME_FORMAT_VERSION_V2;
export const THEME_MAX_TEMPLATE_BYTES = 128 * 1024;
export const THEME_MAX_TEXT_BYTES = 512 * 1024;
export const THEME_MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const THEME_MAX_TOTAL_ASSET_BYTES = 20 * 1024 * 1024;
export const THEME_MAX_ASSETS = 100;
export const THEME_MAX_INSTALLED_VERSIONS = 50;
export const THEME_MAX_DRAFTS = 20;
export const THEME_LIST_PAGE_SIZE = 20;
export const THEME_SEARCH_MAX_LENGTH = 100;
export const LOCAL_THEME_PACKAGE_ID_PREFIX = "local.";
export const RESERVED_THEME_PACKAGE_ID_PREFIX = "microfeed.";

export function isReservedThemePackageId(packageId: string): boolean {
  return packageId.startsWith(RESERVED_THEME_PACKAGE_ID_PREFIX);
}

export function assertUserThemePackageId(packageId: string): void {
  if (!isReservedThemePackageId(packageId)) return;
  throw new Error(
    `Theme package IDs beginning with "${RESERVED_THEME_PACKAGE_ID_PREFIX}" ` +
      "are reserved for bundled microfeed themes. Use a local.* identity for " +
      "a site-specific theme or a package ID you control for a distributable theme.",
  );
}

export const THEME_LIST_SORTS = [
  "status",
  "installed-desc",
  "installed-asc",
  "name-asc",
  "name-desc",
] as const;

export type ThemeListSort = typeof THEME_LIST_SORTS[number];

export interface ThemeListOptions {
  page: number;
  q: string;
  sort: ThemeListSort;
}

export const THEME_FILE_KEYS_V1 = [
  "webFeed",
  "webItem",
  "webHeader",
  "webBodyStart",
  "webBodyEnd",
  "rssStylesheet",
] as const;

export const THEME_FILE_KEYS = [
  ...THEME_FILE_KEYS_V1,
  "webPage",
  "webSearch",
] as const;

export type ThemeFileKey = typeof THEME_FILE_KEYS[number];

const themePathSchema = z.string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !value.startsWith("/"), "Use a relative path.")
  .refine((value) => !value.includes("\\"), "Use forward slashes.")
  .refine(
    (value) => !value.split("/").some((part) => part === ".." || part === "."),
    "Path traversal is not allowed.",
  );

const themeManifestBaseSchema = z.object({
  $schema: z.string().trim().min(1).max(240).optional(),
  assets: z.array(themePathSchema).max(THEME_MAX_ASSETS).default([]),
  author: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  homepage: z.url().optional(),
  license: z.string().trim().min(1).max(100),
  microfeed: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  packageId: z.string()
    .trim()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u,
      "Use lowercase letters, numbers, dots, underscores, and hyphens.",
    ),
  repository: z.url().optional(),
  version: z.string().trim().min(1).max(100),
});

const themeManifestFilesV1Schema = z.object({
    rssStylesheet: themePathSchema,
    webBodyEnd: themePathSchema,
    webBodyStart: themePathSchema,
    webFeed: themePathSchema,
    webHeader: themePathSchema,
    webItem: themePathSchema,
});

export const themeManifestFormatV1Schema = themeManifestBaseSchema.extend({
  files: themeManifestFilesV1Schema,
  formatVersion: z.literal(THEME_FORMAT_VERSION_V1),
});

export const themeManifestV2Schema = themeManifestBaseSchema.extend({
  files: themeManifestFilesV1Schema.extend({
    webPage: themePathSchema,
    webSearch: themePathSchema,
  }),
  formatVersion: z.literal(THEME_FORMAT_VERSION_V2),
});

// Compatibility export retained for theme-kit and management callers. It now
// accepts both the original six-slot format and the eight-slot v2 format.
export const themeManifestV1Schema = z.discriminatedUnion("formatVersion", [
  themeManifestFormatV1Schema,
  themeManifestV2Schema,
]);

export const themeAssetSchema = z.object({
  contentType: z.string().min(1),
  key: z.string().min(1),
  path: themePathSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  size: z.number().int().nonnegative().max(THEME_MAX_ASSET_BYTES),
});

export const themeBundleV1Schema = z.object({
  assets: z.array(themeAssetSchema).max(THEME_MAX_ASSETS).default([]),
  rssStylesheet: z.string(),
  webBodyEnd: z.string(),
  webBodyStart: z.string(),
  webFeed: z.string(),
  webHeader: z.string(),
  webItem: z.string(),
  webPage: z.string().optional(),
  webSearch: z.string().optional(),
});

export const themeRuntimeMetadataSchema = z.object({
  asset_base_url: z.string(),
  package_id: z.string(),
  version: z.string(),
});

const themeAttachmentSchema = z.object({
  duration_in_seconds: z.number().nonnegative().optional(),
  mime_type: z.string().optional(),
  size_in_byte: z.number().int().nonnegative().optional(),
  size_in_bytes: z.number().int().nonnegative().optional(),
  url: z.string(),
}).loose();

const themeItemExtraSchema = z.object({
  date_published_ms: z.number().optional(),
  date_published_short: z.string().optional(),
  duration_hhmmss: z.string().optional(),
  guid: z.string().optional(),
  is_audio: z.boolean().optional(),
  is_document: z.boolean().optional(),
  is_external_url: z.boolean().optional(),
  is_image: z.boolean().optional(),
  is_video: z.boolean().optional(),
  json_url: z.string().optional(),
  "itunes:block": z.boolean().optional(),
  "itunes:episode": z.number().int().optional(),
  "itunes:episodeType": z.string().optional(),
  "itunes:explicit": z.boolean().optional(),
  "itunes:season": z.number().int().optional(),
  "itunes:title": z.string().optional(),
  rss_url: z.string().optional(),
  status: z.string().optional(),
  web_url: z.string().optional(),
}).loose();

export const themeItemSchema = z.object({
  _microfeed: themeItemExtraSchema.optional(),
  attachments: z.array(themeAttachmentSchema).optional(),
  authors: z.array(z.object({name: z.string()}).loose()).optional(),
  banner_image: z.string().optional(),
  content_html: z.string().optional(),
  content_text: z.string().optional(),
  date_modified: z.string().optional(),
  date_published: z.string().optional(),
  external_url: z.string().optional(),
  id: z.string(),
  image: z.string().optional(),
  language: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
}).loose();

const themeSubscribeMethodSchema = z.object({
  editable: z.boolean().optional(),
  enabled: z.boolean().optional(),
  id: z.string().optional(),
  image: z.string().optional(),
  name: z.string(),
  type: z.string().optional(),
  url: z.string().optional(),
}).loose();

const themeFeedExtraSchema = z.object({
  base_url: z.string(),
  categories: z.array(z.object({
    categories: z.array(z.object({name: z.string()})).optional(),
    name: z.string(),
  })),
  copyright: z.string().optional(),
  description_text: z.string().optional(),
  items_next_cursor: z.union([z.string(), z.number()]).optional(),
  items_order: z.enum(["asc", "desc"]).optional(),
  items_prev_cursor: z.union([z.string(), z.number()]).optional(),
  items_sort: z.enum(["created_at", "published_at", "updated_at"]).optional(),
  items_sort_order: z.string().optional(),
  microfeed_version: z.string(),
  next_url: z.string().optional(),
  prev_url: z.string().optional(),
  subscribe_methods: z.union([
    z.literal(""),
    z.array(themeSubscribeMethodSchema),
  ]),
  "itunes:block": z.boolean().optional(),
  "itunes:complete": z.boolean().optional(),
  "itunes:email": z.string().optional(),
  "itunes:explicit": z.boolean().optional(),
  "itunes:new-feed-url": z.string().optional(),
  "itunes:title": z.string().optional(),
  "itunes:type": z.string().optional(),
}).loose();

const themeNavigationPageSchema = z.object({
  id: z.string(),
  navigation_label: z.string(),
  navigation_order: z.number().int(),
  slug: z.string(),
  title: z.string(),
  url: z.string(),
}).loose();

const themePageSchema = z.object({
  content_html: z.string(),
  content_text: z.string(),
  date_created: z.string(),
  date_modified: z.string(),
  date_published: z.string().optional(),
  id: z.string(),
  is_not_found_page: z.boolean(),
  meta_description: z.string().optional(),
  navigation_label: z.string(),
  navigation_order: z.number().int(),
  show_in_navigation: z.boolean(),
  slug: z.string(),
  status: z.enum(["published", "unlisted", "unpublished"]),
  title: z.string(),
  url: z.string(),
}).loose().meta({
  description: "The current standalone Page. This object is available only while rendering the Page template, including the editable special 404 Page when it handles a missing URL.",
});

const themeSearchHighlightSegmentSchema = z.object({
  matched: z.boolean(),
  text: z.string(),
});

const themeSearchResultSchema = z.object({
  content_text: z.string().optional(),
  date_published: z.string().optional(),
  highlights: z.object({
    content_text: z.array(themeSearchHighlightSegmentSchema).optional(),
    title: z.array(themeSearchHighlightSegmentSchema).optional(),
  }).optional(),
  id: z.string().optional(),
  title: z.string(),
  type: z.enum(["item", "page"]),
  url: z.string(),
}).loose();

export const themeContextSchema = z.object({
  _microfeed: themeFeedExtraSchema.optional(),
  _theme: themeRuntimeMetadataSchema,
  authors: z.array(z.object({name: z.string()}).loose()).optional(),
  current_year: z.number().int(),
  description: z.string().optional(),
  expired: z.boolean().optional(),
  favicon: z.string().optional(),
  feed_url: z.string().optional(),
  home_page_url: z.string().optional(),
  icon: z.string().optional(),
  item: themeItemSchema.optional(),
  items: z.array(themeItemSchema),
  navigation_pages: z.array(themeNavigationPageSchema).optional().meta({
    description: "Ordered website navigation entries available to every public HTML theme slot. This array contains only Published Pages whose Show in navigation setting is enabled, in the order chosen in Admin. Draft and Unlisted Pages and the special 404 Page never appear. Navigation is website-only and does not add Pages to RSS or JSON Feed.",
  }),
  page: themePageSchema.optional(),
  search: z.object({
    query: z.string().meta({
      description: "The q query parameter used to render the dedicated Search page.",
    }),
    results: z.array(themeSearchResultSchema).meta({
      description: "Representative results in previews. Live public Search results are safely rendered by microfeed into the documented data-microfeed-search-* hooks.",
    }),
  }).loose().optional().meta({
    description: "Dedicated Search-page state. The theme owns page structure and styling; microfeed owns the public endpoint, popup dialog, keyboard behavior, typeahead, cancellation, highlighting, and safe result hydration.",
  }),
  language: z.string().optional(),
  next_url: z.string().optional(),
  title: z.string().optional(),
  version: z.string(),
}).loose();

export const themeSourceKindSchema = z.enum([
  "admin",
  "bundled",
  "github",
  "local-directory",
  "migration",
]);

export const storedThemeVersionSchema = z.object({
  assetOwnerThemeId: z.string().nullable(),
  bundle: themeBundleV1Schema,
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  id: z.string().min(1),
  manifest: themeManifestV1Schema,
  name: z.string(),
  originThemeId: z.string().nullable(),
  packageId: z.string(),
  sourceCommit: z.string().nullable(),
  sourceKind: themeSourceKindSchema,
  sourcePath: z.string().nullable(),
  sourceRef: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  version: z.string(),
});

export const themeDraftSchema = z.object({
  assetOwnerThemeId: z.string().nullable(),
  bundle: themeBundleV1Schema,
  createdAt: z.string(),
  id: z.string().min(1),
  manifest: themeManifestV1Schema,
  name: z.string(),
  originKind: z.enum(["built-in", "theme"]),
  originThemeId: z.string().nullable(),
  packageId: z.string(),
  updatedAt: z.string(),
  version: z.string(),
});

export type ThemeManifestV1 = z.infer<typeof themeManifestV1Schema>;
export type ThemeBundleV1 = z.infer<typeof themeBundleV1Schema>;
export type ThemeContext = z.infer<typeof themeContextSchema>;
export type ThemeDraft = z.infer<typeof themeDraftSchema>;
export type StoredThemeVersion = z.infer<typeof storedThemeVersionSchema>;
export type ThemeSourceKind = z.infer<typeof themeSourceKindSchema>;

export interface ThemeVersionSummary {
  assetCount: number;
  assetOwnerThemeId: string | null;
  checksumSha256: string;
  createdAt: string;
  deletedAt: string | null;
  id: string;
  manifest: ThemeManifestV1;
  name: string;
  originThemeName: string | null;
  originThemeId: string | null;
  originThemeVersion: string | null;
  packageId: string;
  sourceCommit: string | null;
  sourceKind: ThemeSourceKind;
  sourcePath: string | null;
  sourceRef: string | null;
  sourceUrl: string | null;
  version: string;
}

export interface ThemeDraftSummary {
  assetCount: number;
  assetOwnerThemeId: string | null;
  createdAt: string;
  id: string;
  manifest: ThemeManifestV1;
  name: string;
  originKind: "built-in" | "theme";
  originThemeId: string | null;
  packageId: string;
  updatedAt: string;
  version: string;
}

export interface ThemeListPagination {
  page: number;
  pageSize: typeof THEME_LIST_PAGE_SIZE;
  total: number;
  totalPages: number;
}

export interface ThemeListResponse {
  drafts: ThemeDraftSummary[];
  limits: {
    drafts: typeof THEME_MAX_DRAFTS;
    installed: typeof THEME_MAX_INSTALLED_VERSIONS;
  };
  pagination: ThemeListPagination;
  state: ThemeState;
  themes: ThemeVersionSummary[];
}

export interface ThemeState {
  activeThemeId: string | null;
  previousThemeId: string | null;
  updatedAt: string;
}
