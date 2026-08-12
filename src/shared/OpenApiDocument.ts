import {createDocument} from "zod-openapi";
import {
  apiChannelInputSchema,
  apiErrorSchema,
  apiFeedSchema,
  apiIdempotencyKeySchema,
  apiItemCreateResponseSchema,
  apiItemIdSchema,
  apiItemInputSchema,
  apiItemOutputSchema,
  apiItemValidationResponseSchema,
  apiPageCreateInputSchema,
  apiPageCreateResponseSchema,
  apiPageInputSchema,
  apiPageListResponseSchema,
  apiPageOutputSchema,
  apiPaginationQuerySchema,
  apiSearchQuerySchema,
  apiSearchResponseSchema,
  apiSiteFileCreateResponseSchema,
  apiSiteFileInputSchema,
  apiSiteFileListResponseSchema,
  apiSiteFileOutputSchema,
  apiSiteFilePreviewInputSchema,
  apiSiteFilePreviewResponseSchema,
  apiUploadInputSchema,
  apiUploadOutputSchema,
} from "./ApiSchemas";
import {MICROFEED_VERSION} from "./Version";
import {API_BASE_PATH} from "./ApiVersion";
import * as z from "zod";

const json = (schema: z.ZodType) => ({
  content: {"application/json": {schema}},
});
const success = (schema?: z.ZodType) => ({
  description: "Successful response.",
  ...(schema ? json(schema) : {}),
});
const error = (description: string) => ({
  description,
  ...json(apiErrorSchema),
});
const itemPath = z.object({
  itemId: apiItemIdSchema,
});
const itemCreateHeaders = z.object({
  "Idempotency-Key": apiIdempotencyKeySchema.optional(),
});
const channelPath = z.object({
  channelId: z.literal("primary").meta({
    description: "microfeed currently exposes one primary channel.",
  }),
});
const pagePath = z.object({
  pageId: z.string().min(1).meta({description: "The Page ID."}),
});
const pageListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  next_cursor: z.string().optional(),
  status: z.string().regex(
    /^(?:published|unlisted|unpublished)(?:,(?:published|unlisted|unpublished))*$/u,
  ).default("published,unlisted,unpublished"),
});
const siteFilePath = z.object({
  siteFileId: z.string().min(1).meta({description: "The Site File ID."}),
});

const apiKeySecurity = {bearerAuth: [] as string[]};
const readSecurity = [apiKeySecurity];
const writeSecurity = [apiKeySecurity];

export {API_BASE_PATH};

export const OPENAPI_DOCUMENT = createDocument({
  openapi: "3.1.1",
  info: {
    title: "microfeed API",
    version: MICROFEED_VERSION,
    description:
      "Create, read, update, and delete content in this microfeed instance. " +
      "Send an API key using Bearer authentication.",
    license: {
      name: "GNU Affero General Public License v3.0",
      identifier: "AGPL-3.0-only",
    },
  },
  servers: [{url: API_BASE_PATH, description: "This microfeed instance API"}],
  tags: [
    {name: "Feed", description: "Read the complete feed."},
    {name: "Items", description: "Create and manage feed items."},
    {name: "Pages", description: "Create and manage standalone public Pages."},
    {name: "Site Files", description: "Manage editable root-level text files."},
    {name: "Search", description: "Find items and Pages by title or plain-text content."},
    {name: "Channel", description: "Update the primary channel."},
    {name: "Media", description: "Prepare same-origin media uploads."},
  ],
  paths: {
    "/feed/": {
      get: {
        security: readSecurity,
        operationId: "getFeed",
        summary: "Get the feed",
        tags: ["Feed"],
        requestParams: {query: apiPaginationQuerySchema},
        responses: {
          "200": success(apiFeedSchema),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
    },
    "/items/": {
      post: {
        security: writeSecurity,
        operationId: "createItem",
        summary: "Create an item",
        description:
          "Creates an item. The optional image field is cover art; the optional " +
          "attachments array holds at most one main media attachment, which is " +
          "published as JSON Feed attachments[0] and the RSS enclosure.",
        tags: ["Items"],
        requestParams: {header: itemCreateHeaders},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiItemInputSchema}},
        },
        responses: {
          "201": {
            ...success(apiItemCreateResponseSchema),
            headers: {
              "Idempotency-Replayed": {
                description: "Present with value true when an earlier request reserved this idempotency key.",
                schema: {type: "string", enum: ["true"]},
              },
            },
          },
          "400": error("The request body is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "409": error("The Idempotency-Key was already used with a different item payload."),
        },
      },
    },
    "/items/validate/": {
      post: {
        security: writeSecurity,
        operationId: "validateItem",
        summary: "Validate an item",
        description: "Validates the request with the same schema as item creation without creating content, uploading media, or invalidating caches.",
        tags: ["Items"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiItemInputSchema}},
        },
        responses: {
          "200": success(apiItemValidationResponseSchema),
          "400": error("The request body is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
    },
    "/items/{itemId}/": {
      get: {
        security: readSecurity,
        operationId: "getItem",
        summary: "Get an item",
        tags: ["Items"],
        requestParams: {path: itemPath},
        responses: {
          "200": success(apiFeedSchema),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
      put: {
        security: writeSecurity,
        operationId: "updateItem",
        summary: "Update an item",
        description:
          "Only provided fields are changed; omitted attachments, GUIDs, dates, " +
          "and other fields are preserved. Supplying attachments replaces the one " +
          "main media attachment/RSS enclosure. The image field remains separate " +
          "cover art.",
        tags: ["Items"],
        requestParams: {path: itemPath},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiItemInputSchema}},
        },
        responses: {
          "200": success(apiItemOutputSchema),
          "400": error("The request body or item ID is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
      delete: {
        security: writeSecurity,
        operationId: "deleteItem",
        summary: "Delete an item",
        tags: ["Items"],
        requestParams: {path: itemPath},
        responses: {
          "200": success(z.object({})),
          "400": error("The item ID is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
    },
    "/pages/": {
      get: {
        security: readSecurity,
        operationId: "listPages",
        summary: "List Pages",
        tags: ["Pages"],
        requestParams: {query: pageListQuery},
        responses: {
          "200": success(apiPageListResponseSchema),
          "400": error("The list query or cursor is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
      post: {
        security: writeSecurity,
        operationId: "createPage",
        summary: "Create a Page",
        description: "Creates a top-level Page. A format v2 theme must be active before the Page can be published.",
        tags: ["Pages"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiPageCreateInputSchema}},
        },
        responses: {
          "201": success(apiPageCreateResponseSchema),
          "400": error("The Page input or path is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "409": error("The Page path is already reserved."),
          "422": error("The active theme does not support Pages."),
        },
      },
    },
    "/pages/validate/": {
      post: {
        security: writeSecurity,
        operationId: "validatePage",
        summary: "Validate a Page",
        tags: ["Pages"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiPageCreateInputSchema}},
        },
        responses: {
          "200": success(apiItemValidationResponseSchema),
          "400": error("The Page input is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
    },
    "/pages/{pageId}/": {
      get: {
        security: readSecurity,
        operationId: "getPage",
        summary: "Get a Page",
        tags: ["Pages"],
        requestParams: {path: pagePath},
        responses: {
          "200": success(apiPageOutputSchema),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Page does not exist."),
        },
      },
      put: {
        security: writeSecurity,
        operationId: "updatePage",
        summary: "Update a Page",
        description: "Updates a Page. The built-in 404 Page allows content edits, but its path, published state, navigation exclusion, and existence are protected.",
        tags: ["Pages"],
        requestParams: {path: pagePath},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiPageInputSchema}},
        },
        responses: {
          "200": success(apiPageOutputSchema),
          "400": error("The Page input or path is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Page does not exist."),
          "409": error("The Page path is already reserved."),
          "422": error("The active theme does not support Pages."),
        },
      },
      delete: {
        security: writeSecurity,
        operationId: "deletePage",
        summary: "Delete a Page",
        tags: ["Pages"],
        requestParams: {path: pagePath},
        responses: {
          "200": success(z.object({})),
          "400": error("The built-in 404 Page cannot be deleted."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Page does not exist."),
        },
      },
    },
    "/site-files/": {
      get: {
        security: readSecurity,
        operationId: "listSiteFiles",
        summary: "List Site Files",
        tags: ["Site Files"],
        responses: {
          "200": success(apiSiteFileListResponseSchema),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
      post: {
        security: writeSecurity,
        operationId: "createSiteFile",
        summary: "Create a Site File",
        tags: ["Site Files"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiSiteFileInputSchema}},
        },
        responses: {
          "201": success(apiSiteFileCreateResponseSchema),
          "400": error("The Site File input is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "409": error("The root filename already exists."),
        },
      },
    },
    "/site-files/validate/": {
      post: {
        security: writeSecurity,
        operationId: "validateSiteFile",
        summary: "Validate a Site File",
        tags: ["Site Files"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiSiteFileInputSchema}},
        },
        responses: {
          "200": success(apiItemValidationResponseSchema),
          "400": error("The Site File input is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
    },
    "/site-files/preview/": {
      post: {
        security: writeSecurity,
        operationId: "previewSiteFile",
        summary: "Render a Site File preview",
        description:
          "Renders an unsaved Mustache template with current public feed, Page, item, and _site data. Preview responses are never publicly cached.",
        tags: ["Site Files"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiSiteFilePreviewInputSchema}},
        },
        responses: {
          "200": success(apiSiteFilePreviewResponseSchema),
          "400": error("The template or rendered output is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
    },
    "/site-files/{siteFileId}/": {
      get: {
        security: readSecurity,
        operationId: "getSiteFile",
        summary: "Get a Site File",
        tags: ["Site Files"],
        requestParams: {path: siteFilePath},
        responses: {
          "200": success(apiSiteFileOutputSchema),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
      put: {
        security: writeSecurity,
        operationId: "updateSiteFile",
        summary: "Update a Site File draft",
        tags: ["Site Files"],
        requestParams: {path: siteFilePath},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiSiteFileInputSchema}},
        },
        responses: {
          "200": success(apiSiteFileOutputSchema),
          "400": error("The Site File draft is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
      delete: {
        security: writeSecurity,
        operationId: "deleteSiteFile",
        summary: "Delete a custom Site File",
        tags: ["Site Files"],
        requestParams: {path: siteFilePath},
        responses: {
          "200": success(z.object({})),
          "400": error("Generated Site Files cannot be deleted."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
    },
    "/site-files/{siteFileId}/publish/": {
      post: {
        security: writeSecurity,
        operationId: "publishSiteFile",
        summary: "Publish a Site File draft",
        tags: ["Site Files"],
        requestParams: {path: siteFilePath},
        responses: {
          "200": success(apiSiteFileOutputSchema),
          "400": error("The Site File content is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
    },
    "/site-files/{siteFileId}/reset/": {
      post: {
        security: writeSecurity,
        operationId: "resetSiteFile",
        summary: "Reset a generated Site File",
        tags: ["Site Files"],
        requestParams: {path: siteFilePath},
        responses: {
          "200": success(apiSiteFileOutputSchema),
          "400": error("Only generated Site Files can be reset."),
          "401": error("The Bearer credential is missing or invalid."),
          "404": error("The Site File does not exist."),
        },
      },
    },
    "/search/": {
      get: {
        security: readSecurity,
        operationId: "searchContent",
        summary: "Search items and Pages",
        description:
          "Searches D1 for non-deleted items and Pages. The types query defaults " +
          "to items for backward compatibility. Unquoted terms use AND semantics; " +
          "single- and double-quoted clauses require an exact phrase. Exact " +
          "matches rank before typo-tolerant title matches. Each result is an " +
          "content record with safe title and content highlight segments.",
        tags: ["Search"],
        requestParams: {query: apiSearchQuerySchema},
        responses: {
          "200": success(apiSearchResponseSchema),
          "400": error("The search query, filters, or cursor are invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "403": error("The credential does not have read access."),
          "503": error("Search normalization or indexing is not ready."),
        },
      },
    },
    "/channels/{channelId}/": {
      put: {
        security: writeSecurity,
        operationId: "updatePrimaryChannel",
        summary: "Update the primary channel",
        tags: ["Channel"],
        requestParams: {path: channelPath},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiChannelInputSchema}},
        },
        responses: {
          "200": success(z.object({})),
          "400": error("The request body or channel ID is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
        },
      },
    },
    "/media_files/presigned_urls/": {
      post: {
        security: writeSecurity,
        operationId: "prepareMediaUpload",
        summary: "Prepare a media upload",
        description:
          "Creates a short-lived same-origin upload URL. PUT the raw file bytes " +
          "to presigned_url without a Bearer credential, then save media_url as " +
          "an item image, channel icon, or attachments[0].url. An item media " +
          "attachment is published as the RSS enclosure. Include item_id for an " +
          "attachment; omit it only for cover-image uploads.",
        tags: ["Media"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiUploadInputSchema}},
        },
        responses: {
          "201": success(apiUploadOutputSchema),
          "400": error("The upload request is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "503": error("Media storage is unavailable."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "A full-access mf_ API key sent using Bearer authentication.",
      },
    },
  },
});

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

export const API_OPERATION_SUMMARY = Object.entries(
  OPENAPI_DOCUMENT.paths ?? {},
).flatMap(([pathname, pathItem]) => HTTP_METHODS.flatMap((method) => {
  const operation = pathItem[method];
  return operation
    ? [`${method.toUpperCase()} ${pathname} — ${operation.summary ?? operation.operationId}`]
    : [];
})).join("\n");
