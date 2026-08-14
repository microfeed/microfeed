import * as z from "zod";
import "zod-openapi";

import {API_KEY_SCOPES} from "./Api";
import {STATUSES} from "./Constants";
import {
  PAGE_META_DESCRIPTION_MAX_LENGTH,
  PAGE_SLUG_MAX_LENGTH,
} from "./Pages";
import {WEBHOOK_EVENT_TYPES} from "./Webhooks";

export const apiItemIdSchema = z.string().min(1).meta({
  description: "The microfeed item ID or an item-page slug ending in that ID.",
  example: "0HGJLSML3P1",
});

export const apiStatusSchema = z.union([
  z.enum(["published", "unlisted", "unpublished"]),
  z.number().int().min(1).max(4),
]).meta({
  description: "The item visibility. Names are preferred; numeric values are retained for compatibility.",
  example: "published",
});

export const apiAttachmentSchema = z.object({
  category: z.enum(["audio", "video", "document", "image", "external_url"]).meta({
    description: "How the main media attachment should be presented. Use external_url only for a linked web page rather than an uploaded file.",
    example: "audio",
  }),
  duration_in_seconds: z.number().nonnegative().optional().meta({
    description: "Optional playback duration for an audio or video attachment.",
    example: 1262,
  }),
  mime_type: z.string().optional().meta({
    description: "Media type of the attachment, such as audio/mpeg or image/png.",
    example: "audio/mpeg",
  }),
  size_in_byte: z.number().int().nonnegative().optional().meta({
    deprecated: true,
    description: "Deprecated singular spelling. Use size_in_bytes.",
  }),
  size_in_bytes: z.number().int().nonnegative().optional().meta({
    description: "Attachment size in bytes. RSS uses this as the enclosure length.",
    example: 277000,
  }),
  url: z.url().meta({
    description: "Permanent attachment URL. Uploaded media should use media_url returned by the upload-preparation operation.",
    example: "https://feed.example.com/media/production/media/audio.mp3",
  }),
}).loose().meta({
  id: "Attachment",
  description: "The item's one main media attachment. It appears as JSON Feed attachments[0] and as the RSS enclosure.",
});

export const apiAttachmentOutputSchema = apiAttachmentSchema.extend({
  category: apiAttachmentSchema.shape.category.optional(),
  url: z.string().min(1),
}).meta({id: "AttachmentOutput"});

export const apiItemInputSchema = z.object({
  _microfeed: z.record(z.string(), z.unknown()).optional(),
  attachment: apiAttachmentSchema.optional().meta({
    description: "Compatibility input alias for attachments[0]. Prefer attachments.",
  }),
  attachments: z.array(apiAttachmentSchema).max(1).optional().meta({
    description: "Zero or one main media attachment. This is distinct from the item cover image and becomes the RSS enclosure.",
  }),
  content_html: z.string().optional(),
  date_published: z.iso.datetime().optional(),
  date_published_ms: z.number().int().nonnegative().optional(),
  guid: z.string().optional(),
  id: z.string().optional(),
  image: z.url().optional().meta({
    description: "Item-specific cover art or thumbnail. This is not the main media attachment or RSS enclosure.",
    example: "https://feed.example.com/media/production/images/item.png",
  }),
  status: apiStatusSchema.optional(),
  title: z.string().optional(),
  url: z.url().optional(),
}).loose().meta({id: "ItemInput"});

export const apiIdempotencyKeySchema = z.string().min(1).max(128).regex(
  /^(?:[\x21-\x7e]|[\x21-\x7e][\x20-\x7e]*[\x21-\x7e])$/u,
  "Use 1–128 printable ASCII characters without surrounding whitespace.",
).meta({
  description: "A caller-generated key that makes retries of one logical item creation safe for 24 hours.",
  example: "8ca861ab-0383-4f10-bbc2-8c80d8ef29dc",
});

export const apiItemCreateResponseSchema = z.object({
  id: z.string(),
}).meta({id: "ItemCreateResponse"});

export const apiItemValidationResponseSchema = z.object({
  valid: z.literal(true),
}).meta({id: "ItemValidationResponse"});

export const apiItemOutputSchema = apiItemInputSchema.extend({
  attachments: z.array(apiAttachmentOutputSchema).optional(),
  content_text: z.string(),
  date_modified: z.iso.datetime().optional(),
  date_published: z.iso.datetime().optional(),
  id: z.string(),
  image: z.string().optional(),
  url: z.string().optional(),
}).meta({id: "Item"});

const PAGE_NAVIGATION_VISIBILITY_DESCRIPTION =
  "Whether the Page is eligible for website navigation. This setting is only active when status is published. For an unpublished Draft, it is stored but ignored until the Page is published. For an unlisted Page, it is always forced to false.";

const PAGE_VISIBILITY_DESCRIPTION =
  "The Page visibility: published is public and discoverable; unlisted remains public at its direct URL but cannot appear in navigation; unpublished is a private Draft.";

export const apiPageInputSchema = z.object({
  content_html: z.string().optional().meta({
    description: "The Page body as sanitized rich-text HTML.",
  }),
  meta_description: z.string().max(PAGE_META_DESCRIPTION_MAX_LENGTH)
    .nullable().optional().meta({
      description: `An optional plain-text summary used in the Page's HTML meta description. Maximum ${PAGE_META_DESCRIPTION_MAX_LENGTH} characters.`,
    }),
  navigation_label: z.string().max(100).optional().meta({
    description: "The manually chosen text used for this Page in website navigation. Required when show_in_navigation is true unless the Page is Unlisted.",
    example: "About",
  }),
  show_in_navigation: z.boolean().optional().meta({
    description: PAGE_NAVIGATION_VISIBILITY_DESCRIPTION,
  }),
  slug: z.string().min(1).max(PAGE_SLUG_MAX_LENGTH).optional().meta({
    description: "A top-level path segment, such as about for /about/.",
    example: "about",
  }),
  status: apiStatusSchema.optional().meta({
    description: PAGE_VISIBILITY_DESCRIPTION,
  }),
  title: z.string().min(1).max(200).optional(),
}).meta({id: "PageInput"});

export const apiPageCreateInputSchema = apiPageInputSchema.extend({
  slug: z.string().trim().min(1).max(PAGE_SLUG_MAX_LENGTH).meta({
    description: "The required, manually chosen top-level path segment, such as about for /about/.",
    example: "about",
  }),
  title: z.string().trim().min(1).max(200),
}).superRefine((input, context) => {
  if (
    input.status !== "unlisted" && input.status !== STATUSES.UNLISTED &&
    input.show_in_navigation !== false &&
    !input.navigation_label?.trim()
  ) {
    context.addIssue({
      code: "custom",
      message: "Enter a navigation label, or turn off Show in navigation.",
      path: ["navigation_label"],
    });
  }
}).meta({id: "PageCreateInput"});

export function pageInputErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "");
  if (issue?.code === "custom") return issue.message;
  if (field === "title") {
    return issue?.code === "too_big"
      ? "Page title must be 200 characters or fewer."
      : "Give the Page a title.";
  }
  if (field === "slug") {
    return issue?.code === "too_big"
      ? `URL path must be ${PAGE_SLUG_MAX_LENGTH} characters or fewer.`
      : "Enter a URL path, such as about.";
  }
  if (field === "navigation_label") {
    return issue?.code === "too_big"
      ? "Navigation label must be 100 characters or fewer."
      : "Enter a navigation label, or turn off Show in navigation.";
  }
  if (field === "meta_description") {
    return `Search and social description must be ${PAGE_META_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }
  return "Check the Page fields and try again.";
}

export const apiPageOutputSchema = apiPageInputSchema.extend({
  content_html: z.string(),
  content_text: z.string(),
  date_created: z.iso.datetime(),
  date_modified: z.iso.datetime(),
  date_published: z.iso.datetime().optional(),
  id: z.string(),
  is_not_found_page: z.boolean().meta({
    description: "Whether this is the protected Page used for public 404 responses.",
  }),
  navigation_label: z.string(),
  navigation_order: z.number().int(),
  show_in_navigation: z.boolean().meta({
    description: PAGE_NAVIGATION_VISIBILITY_DESCRIPTION,
  }),
  slug: z.string(),
  status: z.enum(["published", "unlisted", "unpublished"]).meta({
    description: PAGE_VISIBILITY_DESCRIPTION,
  }),
  title: z.string(),
  url: z.url(),
}).meta({id: "Page"});

export const apiPageListResponseSchema = z.object({
  items: z.array(apiPageOutputSchema),
  next_cursor: z.string().optional(),
}).meta({id: "PageListResponse"});

export const apiPageCreateResponseSchema = z.object({
  id: z.string(),
}).meta({id: "PageCreateResponse"});

export const apiSiteFileMediaTypeSchema = z.enum([
  "application/json",
  "application/manifest+json",
  "application/rss+xml",
  "application/xml",
  "text/css",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/yaml",
]);

export const apiSiteFileInputSchema = z.object({
  content_type: apiSiteFileMediaTypeSchema.optional(),
  draft_content: z.string().optional().meta({
    description:
      "A Mustache template. It is rendered with the public feed, Pages, items, and _site helpers when previewed or served.",
  }),
  enabled: z.boolean().optional(),
  filename: z.string().min(1).max(128).optional().meta({
    description: "A lowercase root filename with a supported text extension.",
    example: "security.txt",
  }),
}).meta({id: "SiteFileInput"});

export const apiSiteFileOutputSchema = apiSiteFileInputSchema.extend({
  content_type: apiSiteFileMediaTypeSchema,
  date_created: z.iso.datetime(),
  date_modified: z.iso.datetime(),
  date_published: z.iso.datetime().optional(),
  draft_content: z.string(),
  enabled: z.boolean(),
  filename: z.string(),
  generator: z.enum(["robots", "llms", "sitemap"]).optional(),
  id: z.string(),
  mode: z.enum(["generated", "override"]),
  published_content: z.string().optional().meta({
    description: "The currently published Mustache template.",
  }),
  system: z.boolean(),
  url: z.url(),
}).meta({id: "SiteFile"});

export const apiSiteFileListResponseSchema = z.object({
  items: z.array(apiSiteFileOutputSchema),
}).meta({id: "SiteFileListResponse"});

export const apiSiteFileCreateResponseSchema = z.object({
  id: z.string(),
}).meta({id: "SiteFileCreateResponse"});

export const apiSiteFilePreviewInputSchema = apiSiteFileInputSchema.extend({
  draft_content: z.string(),
  site_file_id: z.string().min(1).optional().meta({
    description:
      "The existing Site File ID, used to preserve its built-in generator context.",
  }),
}).meta({id: "SiteFilePreviewInput"});

export const apiSiteFilePreviewResponseSchema = z.object({
  content_type: apiSiteFileMediaTypeSchema,
  rendered_content: z.string(),
  valid: z.literal(true),
}).meta({id: "SiteFilePreviewResponse"});

export const apiSearchHighlightSegmentSchema = z.object({
  matched: z.boolean(),
  text: z.string(),
}).meta({id: "SearchHighlightSegment"});

export const apiSearchItemSchema = apiItemOutputSchema.and(z.object({
  type: z.literal("item"),
  highlights: z.object({
    content_text: z.array(apiSearchHighlightSegmentSchema),
    title: z.array(apiSearchHighlightSegmentSchema),
  }),
}).loose()).meta({id: "SearchItem"});

export const apiSearchPageSchema = apiPageOutputSchema.omit({
  content_html: true,
  date_created: true,
}).and(z.object({
  type: z.literal("page"),
  highlights: z.object({
    content_text: z.array(apiSearchHighlightSegmentSchema),
    title: z.array(apiSearchHighlightSegmentSchema),
  }),
}).loose()).meta({id: "SearchPage"});

export const apiSearchResponseSchema = z.object({
  items: z.array(z.union([apiSearchItemSchema, apiSearchPageSchema])),
  next_cursor: z.string().optional(),
}).meta({id: "SearchResponse"});

export const apiSearchQuerySchema = z.object({
  date_published_ms_gt: z.coerce.number().int().nonnegative().optional().meta({
    description: "Return items published strictly after this Unix timestamp in milliseconds.",
  }),
  date_published_ms_lt: z.coerce.number().int().nonnegative().optional().meta({
    description: "Return items published strictly before this Unix timestamp in milliseconds.",
  }),
  fields: z.enum([
    "title",
    "content",
    "title,content",
    "content,title",
  ]).default("title,content").meta({
    description: "Comma-separated fields to search. The default searches title and content.",
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  next_cursor: z.string().min(1).max(2048).optional(),
  q: z.string().trim().min(1).max(200).meta({
    description: "Terms are ANDed. Use single or double quotes for an exact phrase.",
    example: 'launch "season finale"',
  }),
  status: z.string().regex(
    /^(?:published|unlisted|unpublished)(?:,(?:published|unlisted|unpublished))*$/u,
  ).default("published,unlisted,unpublished").meta({
    description: "Comma-separated content statuses. Deleted content is never searched.",
  }),
  types: z.enum([
    "items",
    "pages",
    "items,pages",
    "pages,items",
  ]).default("items").meta({
    description: "Content types to search. The default preserves item-only behavior.",
  }),
});

export const apiFeedMicrofeedSchema = z.object({
  copyright: z.string().optional().meta({
    description: "Rendered channel copyright. A supported {{current_year}} variable in the saved channel has already been replaced with the current UTC year.",
    example: "© 2026 Example Publisher",
  }),
}).loose().meta({id: "FeedMicrofeed"});

export const apiFeedSchema = z.object({
  _microfeed: apiFeedMicrofeedSchema.optional(),
  description: z.string().optional(),
  favicon: z.string().optional(),
  feed_url: z.string().optional(),
  home_page_url: z.string().optional(),
  icon: z.string().optional(),
  items: z.array(apiItemOutputSchema),
  language: z.string().optional(),
  next_url: z.string().optional(),
  title: z.string().optional(),
  version: z.string(),
}).loose().meta({id: "Feed"});

export const apiChannelMicrofeedInputSchema = z.object({
  copyright: z.string().optional().meta({
    description: "Channel copyright text. Use the allowlisted {{current_year}} variable to publish the current UTC year automatically; the expression is saved literally and resolved in public output.",
    example: "© {{current_year}} Example Publisher",
  }),
}).loose().meta({id: "ChannelMicrofeedInput"});

export const apiChannelInputSchema = z.object({
  _microfeed: apiChannelMicrofeedInputSchema.optional(),
  authors: z.array(z.object({name: z.string()})).optional(),
  description: z.string().optional(),
  expired: z.boolean().optional(),
  home_page_url: z.url().optional().meta({deprecated: true}),
  homepage_url: z.url().optional(),
  icon: z.url().optional(),
  language: z.string().optional(),
  title: z.string().optional(),
}).loose().meta({id: "ChannelInput"});

export const apiUploadInputSchema = z.object({
  category: z.enum(["image", "audio", "video", "document"]).meta({
    description: "The uploaded file category. For an item attachment, this must match attachments[0].category.",
    example: "audio",
  }),
  full_local_file_path: z.string().min(1).meta({
    description: "A filename or local path used to preserve the extension. The server never reads this path.",
    example: "/tmp/episode.mp3",
  }),
  item_id: z.string().optional().meta({
    description: "The existing item ID that will own a media attachment. Required for audio, video, and document uploads; include it for an image attachment. Omit it only for item or channel cover-image uploads.",
    example: "0HGJLSML3P1",
  }),
  size: z.number().int().nonnegative().optional().meta({
    description: "Expected upload size in bytes.",
  }),
  type: z.string().optional().meta({
    description: "Expected media type, such as audio/mpeg.",
  }),
}).meta({id: "UploadRequest"});

export const apiUploadOutputSchema = z.object({
  media_url: z.url().meta({
    description: "Permanent URL to save as the item image, channel icon, or attachment URL after the upload succeeds.",
  }),
  presigned_url: z.url().meta({
    description: "Send the file bytes to this same-origin URL using HTTP PUT before saving media_url.",
  }),
}).meta({id: "UploadResponse"});

export const apiErrorSchema = z.object({
  error: z.string(),
}).meta({id: "Error"});

export const apiPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional(),
  next_cursor: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  prev_cursor: z.string().optional(),
  sort: z.enum([
    "created_at",
    "updated_at",
    "published_at",
    "newest_first",
    "oldest_first",
  ]).optional(),
});

export const apiSettingsCommandSchema = z.object({
  enabled: z.boolean(),
  publicDocsEnabled: z.boolean(),
});

export const apiAutomationContextIdSchema = z.string().min(1).max(128).regex(
  /^[\x20-\x7e]+$/u,
  "Use at most 128 printable ASCII characters.",
).meta({
  description:
    "An automation trace identifier. Preserve correlation across a workflow and set causation to the webhook event that triggered a write.",
  example: "evt_12345678-1234-4123-8123-123456789abc",
});

export const apiWebhookContextHeadersSchema = z.object({
  "Microfeed-Causation-Id": apiAutomationContextIdSchema.optional(),
  "Microfeed-Correlation-Id": apiAutomationContextIdSchema.optional(),
});

export const apiWebhookDeliveryHeadersSchema = z.object({
  "webhook-id": z.string().min(1).meta({
    description: "Unique delivery ID used for receiver deduplication.",
  }),
  "webhook-signature": z.string().min(1).meta({
    description: "Standard Webhooks HMAC signature, such as v1,<base64>.",
  }),
  "webhook-timestamp": z.string().regex(/^\d+$/u).meta({
    description: "Unix timestamp in seconds used by signature verification.",
  }),
  "x-microfeed-attempt": z.string().regex(/^\d+$/u).meta({
    description: "One-based delivery attempt number.",
  }),
  "x-microfeed-event": z.enum(WEBHOOK_EVENT_TYPES).meta({
    description: "The event type duplicated from the JSON envelope.",
  }),
});

export const apiWebhookSiteSchema = z.object({
  id: z.string(),
  url: z.url(),
}).meta({id: "WebhookSite"});

export const apiWebhookSubjectSchema = z.object({
  api_path: z.string().optional(),
  id: z.string(),
  type: z.enum(["channel", "item", "page", "site_file", "theme", "webhook"]),
}).meta({id: "WebhookSubject"});

export const apiWebhookChannelSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("channel"),
}).meta({id: "WebhookChannelSubject"});
export const apiWebhookItemSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("item"),
}).meta({id: "WebhookItemSubject"});
export const apiWebhookPageSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("page"),
}).meta({id: "WebhookPageSubject"});
export const apiWebhookSiteFileSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("site_file"),
}).meta({id: "WebhookSiteFileSubject"});
export const apiWebhookThemeSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("theme"),
}).meta({id: "WebhookThemeSubject"});
export const apiWebhookTestSubjectSchema = apiWebhookSubjectSchema.extend({
  type: z.literal("webhook"),
}).meta({id: "WebhookTestSubject"});

export const apiWebhookContextSchema = z.object({
  causation_id: apiAutomationContextIdSchema.nullable(),
  correlation_id: apiAutomationContextIdSchema,
  origin: z.enum(["dashboard", "api", "system"]),
  request_id: z.string(),
}).meta({id: "WebhookContext"});

export const apiWebhookDataSchema = z.object({
  changed_fields: z.array(z.string()),
  object: z.record(z.string(), z.unknown()),
  previous_status: z.string().nullable(),
  truncated_fields: z.array(z.string()),
}).meta({id: "WebhookData"});

export const apiWebhookChannelDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookChannelData",
});
export const apiWebhookItemDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookItemData",
});
export const apiWebhookPageDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookPageData",
});
export const apiWebhookSiteFileDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookSiteFileData",
});
export const apiWebhookThemeDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookThemeData",
});
export const apiWebhookTestDataSchema = apiWebhookDataSchema.meta({
  id: "WebhookTestData",
});

const apiWebhookEventBaseSchema = z.object({
  api_version: z.literal("1"),
  context: apiWebhookContextSchema,
  id: z.string().startsWith("evt_"),
  site: apiWebhookSiteSchema,
  timestamp: z.iso.datetime(),
});

const webhookVariant = <T extends typeof WEBHOOK_EVENT_TYPES[number]>(
  type: T,
  subject: z.ZodType,
  data: z.ZodType,
) => apiWebhookEventBaseSchema.extend({data, subject, type: z.literal(type)});

export const apiWebhookEventSchema = z.discriminatedUnion("type", [
  webhookVariant("channel.updated", apiWebhookChannelSubjectSchema, apiWebhookChannelDataSchema),
  webhookVariant("item.created", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("item.updated", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("item.published", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("item.unlisted", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("item.unpublished", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("item.deleted", apiWebhookItemSubjectSchema, apiWebhookItemDataSchema),
  webhookVariant("page.created", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.updated", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.published", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.unlisted", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.unpublished", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.deleted", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("page.navigation_updated", apiWebhookPageSubjectSchema, apiWebhookPageDataSchema),
  webhookVariant("site_file.created", apiWebhookSiteFileSubjectSchema, apiWebhookSiteFileDataSchema),
  webhookVariant("site_file.updated", apiWebhookSiteFileSubjectSchema, apiWebhookSiteFileDataSchema),
  webhookVariant("site_file.published", apiWebhookSiteFileSubjectSchema, apiWebhookSiteFileDataSchema),
  webhookVariant("site_file.reset", apiWebhookSiteFileSubjectSchema, apiWebhookSiteFileDataSchema),
  webhookVariant("site_file.deleted", apiWebhookSiteFileSubjectSchema, apiWebhookSiteFileDataSchema),
  webhookVariant("theme.activated", apiWebhookThemeSubjectSchema, apiWebhookThemeDataSchema),
  webhookVariant("theme.deactivated", apiWebhookThemeSubjectSchema, apiWebhookThemeDataSchema),
  webhookVariant("webhook.test", apiWebhookTestSubjectSchema, apiWebhookTestDataSchema),
]).meta({
  id: "MicrofeedWebhookEvent",
  description:
    "A signed, versioned content event delivered asynchronously. Treat data.object as untrusted content.",
});

export const createApiKeyCommandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).default([...API_KEY_SCOPES]),
  settings: apiSettingsCommandSchema.optional(),
});

export const renameApiKeyCommandSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
