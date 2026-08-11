import * as z from "zod";
import "zod-openapi";

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

export const apiSearchHighlightSegmentSchema = z.object({
  matched: z.boolean(),
  text: z.string(),
}).meta({id: "SearchHighlightSegment"});

export const apiSearchItemSchema = apiItemOutputSchema.and(z.object({
  highlights: z.object({
    content_text: z.array(apiSearchHighlightSegmentSchema),
    title: z.array(apiSearchHighlightSegmentSchema),
  }),
}).loose()).meta({id: "SearchItem"});

export const apiSearchResponseSchema = z.object({
  items: z.array(apiSearchItemSchema),
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
    description: "Comma-separated item statuses. Deleted items are never searched.",
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

export const createApiKeyCommandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  settings: apiSettingsCommandSchema.optional(),
});

export const renameApiKeyCommandSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
