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
import {OAUTH_SCOPES} from "./OAuth";
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

const apiKeySecurity = {bearerAuth: [] as string[]};
const readSecurity = [apiKeySecurity, {oauth2: [OAUTH_SCOPES.READ]}];
const writeSecurity = [apiKeySecurity, {oauth2: [OAUTH_SCOPES.WRITE]}];

export {API_BASE_PATH};

export const OPENAPI_DOCUMENT = createDocument({
  openapi: "3.1.1",
  info: {
    title: "microfeed API",
    version: MICROFEED_VERSION,
    description:
      "Create, read, update, and delete content in this microfeed instance. " +
      "Send either an API key or a scoped OAuth access token using Bearer authentication.",
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
          "403": error("The OAuth token lacks content:read scope."),
        },
      },
    },
    "/items/": {
      post: {
        security: writeSecurity,
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
          "401": error("The Bearer credential is missing or invalid."),
          "403": error("The OAuth token lacks content:write scope."),
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
          "403": error("The OAuth token lacks content:read scope."),
          "404": error("The item does not exist."),
        },
      },
      put: {
        security: writeSecurity,
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
          "401": error("The Bearer credential is missing or invalid."),
          "403": error("The OAuth token lacks content:write scope."),
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
          "403": error("The OAuth token lacks content:write scope."),
          "404": error("The item does not exist."),
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
          "403": error("The OAuth token lacks content:write scope."),
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
          "to presigned_url, then save media_url on an item or channel.",
        tags: ["Media"],
        requestBody: {
          required: true,
          content: {"application/json": {schema: apiUploadInputSchema}},
        },
        responses: {
          "201": success(apiUploadOutputSchema),
          "400": error("The upload request is invalid."),
          "401": error("The Bearer credential is missing or invalid."),
          "403": error("The OAuth token lacks content:write scope."),
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
      oauth2: {
        type: "oauth2",
        description: "A short-lived access token issued by this microfeed instance.",
        flows: {
          authorizationCode: {
            authorizationUrl: "/api/auth/oauth2/authorize",
            tokenUrl: "/api/auth/oauth2/token",
            refreshUrl: "/api/auth/oauth2/token",
            scopes: {
              [OAUTH_SCOPES.READ]: "Read feeds and items.",
              [OAUTH_SCOPES.WRITE]:
                "Create, update, and delete items; update the channel; prepare media uploads.",
              [OAUTH_SCOPES.OFFLINE]: "Obtain a rotating refresh token.",
            },
          },
        },
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
