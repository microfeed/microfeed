import {createDocument} from "zod-openapi";
import {
  apiChannelInputSchema,
  apiErrorSchema,
  apiFeedSchema,
  apiItemIdSchema,
  apiItemInputSchema,
  apiItemOutputSchema,
  apiPaginationQuerySchema,
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
const channelPath = z.object({
  channelId: z.literal("primary").meta({
    description: "microfeed currently exposes one primary channel.",
  }),
});

const operationSecurity: [{bearerAuth: string[]}] = [{bearerAuth: []}];

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
    {name: "Channel", description: "Update the primary channel."},
    {name: "Media", description: "Prepare same-origin media uploads."},
  ],
  security: operationSecurity,
  paths: {
    "/feed/": {
      get: {
        operationId: "getFeed",
        summary: "Get the feed",
        tags: ["Feed"],
        requestParams: {query: apiPaginationQuerySchema},
        responses: {
          "200": success(apiFeedSchema),
          "401": error("The API key is missing or invalid."),
        },
      },
    },
    "/items/": {
      post: {
        operationId: "createItem",
        summary: "Create an item",
        tags: ["Items"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiItemInputSchema}},
        },
        responses: {
          "201": success(z.object({id: z.string()})),
          "400": error("The request body is invalid."),
          "401": error("The API key is missing or invalid."),
        },
      },
    },
    "/items/{itemId}/": {
      get: {
        operationId: "getItem",
        summary: "Get an item",
        tags: ["Items"],
        requestParams: {path: itemPath},
        responses: {
          "200": success(apiFeedSchema),
          "401": error("The API key is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
      put: {
        operationId: "updateItem",
        summary: "Update an item",
        description: "Only provided fields are changed. Attachments, GUIDs, dates, and omitted fields are preserved.",
        tags: ["Items"],
        requestParams: {path: itemPath},
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiItemInputSchema}},
        },
        responses: {
          "200": success(apiItemOutputSchema),
          "400": error("The request body or item ID is invalid."),
          "401": error("The API key is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
      delete: {
        operationId: "deleteItem",
        summary: "Delete an item",
        tags: ["Items"],
        requestParams: {path: itemPath},
        responses: {
          "200": success(z.object({})),
          "400": error("The item ID is invalid."),
          "401": error("The API key is missing or invalid."),
          "404": error("The item does not exist."),
        },
      },
    },
    "/channels/{channelId}/": {
      put: {
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
          "401": error("The API key is missing or invalid."),
        },
      },
    },
    "/media_files/presigned_urls/": {
      post: {
        operationId: "prepareMediaUpload",
        summary: "Prepare a media upload",
        description:
          "Creates a short-lived same-origin upload URL. PUT the raw file bytes " +
          "to presigned_url, then save media_url on an item or channel.",
        tags: ["Media"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiUploadInputSchema}},
        },
        responses: {
          "201": success(apiUploadOutputSchema),
          "400": error("The upload request is invalid."),
          "401": error("The API key is missing or invalid."),
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
        description: "An API key sent using Bearer authentication.",
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
