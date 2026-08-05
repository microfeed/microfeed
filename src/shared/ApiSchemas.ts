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
  category: z.enum(["audio", "video", "document", "image", "external_url"]),
  duration_in_seconds: z.number().nonnegative().optional(),
  mime_type: z.string().optional(),
  size_in_byte: z.number().int().nonnegative().optional().meta({
    deprecated: true,
    description: "Deprecated singular spelling. Use size_in_bytes.",
  }),
  size_in_bytes: z.number().int().nonnegative().optional(),
  url: z.url(),
}).loose().meta({id: "Attachment"});

export const apiAttachmentOutputSchema = apiAttachmentSchema.extend({
  category: apiAttachmentSchema.shape.category.optional(),
  url: z.string().min(1),
}).meta({id: "AttachmentOutput"});

export const apiItemInputSchema = z.object({
  _microfeed: z.record(z.string(), z.unknown()).optional(),
  attachment: apiAttachmentSchema.optional(),
  attachments: z.array(apiAttachmentSchema).max(1).optional(),
  content_html: z.string().optional(),
  date_published: z.iso.datetime().optional(),
  date_published_ms: z.number().int().nonnegative().optional(),
  guid: z.string().optional(),
  id: z.string().optional(),
  image: z.url().optional(),
  status: apiStatusSchema.optional(),
  title: z.string().optional(),
  url: z.url().optional(),
}).loose().meta({id: "ItemInput"});

export const apiItemOutputSchema = apiItemInputSchema.extend({
  attachments: z.array(apiAttachmentOutputSchema).optional(),
  date_modified: z.iso.datetime().optional(),
  date_published: z.iso.datetime().optional(),
  id: z.string(),
  image: z.string().optional(),
  url: z.string().optional(),
}).meta({id: "Item"});

export const apiFeedSchema = z.object({
  _microfeed: z.record(z.string(), z.unknown()).optional(),
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

export const apiChannelInputSchema = z.object({
  _microfeed: z.record(z.string(), z.unknown()).optional(),
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
  category: z.enum(["image", "audio", "video", "document"]),
  full_local_file_path: z.string().min(1).meta({
    description: "A filename or local path used to preserve the extension. The server never reads this path.",
    example: "/tmp/episode.mp3",
  }),
  item_id: z.string().optional().meta({
    description: "Required for audio, video, and document uploads.",
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
    description: "The URL to save in the item or channel after the upload succeeds.",
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
