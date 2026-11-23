import * as z from "zod";
import * as schemas from "@/shared/ApiSchemas";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";
import {OAUTH_SCOPES} from "@/shared/OAuth";
import * as operations from "@/server/content/operations";
import * as tags from "@/server/tags/operations";
import {contentResult, feedResult, type ContentOperation} from "@/server/content/operation";
import {podcastChaptersData} from "@/server/feed/responses";

const id = z.string().min(1);
const pageList = schemas.apiPageListQuerySchema;
const tagList = schemas.apiTagListQuerySchema;
const descriptions = new Map(Object.values(OPENAPI_DOCUMENT.paths ?? {}).flatMap(path =>
  Object.values(path).filter(value => value && typeof value === "object" && "operationId" in value)
    .map(value => {
      const operation = value as {operationId: string; summary?: string; description?: string};
      return [operation.operationId, [operation.summary, operation.description].filter(Boolean).join(". ")] as const;
    }),
));

function tool(operationId: string, operation: ContentOperation, fields: z.ZodRawShape = {}, options: {
  input?: z.ZodType; write?: boolean; readOnly?: boolean; destructive?: boolean;
} = {}) {
  return {
    operationId,
    name: operationId.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase(),
    description: descriptions.get(operationId) ?? operationId,
    operation,
    scope: options.write ? OAUTH_SCOPES.WRITE : OAUTH_SCOPES.READ,
    readOnly: options.readOnly ?? !options.write,
    destructive: options.destructive ?? Boolean(options.write && !options.readOnly),
    schema: z.object({
      ...fields,
      ...(options.input ? {input: options.input} : {}),
      ...(options.write ? {automationContext: schemas.apiWebhookContextHeadersSchema.optional()} : {}),
    }),
  };
}

export const MCP_TOOLS = [
  tool("getFeed", operations.getFeedOperation, schemas.apiPaginationQuerySchema.shape),
  tool("searchContent", operations.searchItemsOperation, schemas.apiSearchQuerySchema.shape),
  tool("getItem", operations.getItemOperation, {itemId: schemas.apiItemIdSchema}),
  tool("createItem", operations.createItemOperation, {idempotencyKey: schemas.apiIdempotencyKeySchema.optional()}, {input: schemas.apiItemInputSchema, write: true, destructive: false}),
  tool("updateItem", operations.updateItemOperation, {itemId: schemas.apiItemIdSchema}, {input: schemas.apiItemInputSchema, write: true}),
  tool("deleteItem", operations.deleteItemOperation, {itemId: schemas.apiItemIdSchema}, {write: true}),
  tool("validateItem", operations.validateItemOperation, {}, {input: schemas.apiItemInputSchema, write: true, readOnly: true}),
  tool("listPages", operations.listPagesOperation, pageList.shape),
  tool("getPage", operations.getPageOperation, {pageId: id}),
  tool("createPage", operations.createPageOperation, {}, {input: schemas.apiPageCreateInputSchema, write: true, destructive: false}),
  tool("updatePage", operations.updatePageOperation, {pageId: id}, {input: schemas.apiPageInputSchema, write: true}),
  tool("deletePage", operations.deletePageOperation, {pageId: id}, {write: true}),
  tool("validatePage", operations.validatePageOperation, {}, {input: schemas.apiPageCreateInputSchema, write: true, readOnly: true}),
  tool("listTags", tags.listTagsOperation, tagList.shape),
  tool("createTag", tags.createTagOperation, {}, {input: schemas.apiTagCreateInputSchema, write: true, destructive: false}),
  ...([false, true] as const).flatMap(byId => {
    const suffix = byId ? "ById" : "BySlug";
    const fields: z.ZodRawShape = byId ? {tagId: id} : {slug: id};
    return [
      tool(`getTag${suffix}`, tags.getTagOperation, fields),
      tool(`updateTag${suffix}`, tags.updateTagOperation, fields, {input: schemas.apiTagInputSchema, write: true}),
      tool(`deleteTag${suffix}`, tags.deleteTagOperation, fields, {write: true}),
    ];
  }),
  tool("updatePrimaryChannel", operations.updatePrimaryChannelOperation, {channelId: z.literal("primary")}, {input: schemas.apiChannelInputSchema, write: true}),
  tool("prepareMediaUpload", operations.prepareMediaUploadOperation, {}, {input: schemas.apiUploadInputSchema, write: true, destructive: false}),
  tool("getPodcastChapters", async ({request, params}) => {
    const data = await podcastChaptersData(request, params.slug!);
    return data instanceof Response ? feedResult(data) : contentResult(data);
  }, {slug: id}),
  tool("listSiteFiles", operations.listSiteFilesOperation),
  tool("getSiteFile", operations.getSiteFileOperation, {siteFileId: id}),
  tool("createSiteFile", operations.createSiteFileOperation, {}, {input: schemas.apiSiteFileInputSchema, write: true, destructive: false}),
  tool("updateSiteFile", operations.updateSiteFileOperation, {siteFileId: id}, {input: schemas.apiSiteFileInputSchema, write: true}),
  tool("deleteSiteFile", operations.deleteSiteFileOperation, {siteFileId: id}, {write: true}),
  tool("validateSiteFile", operations.validateSiteFileOperation, {}, {input: schemas.apiSiteFileInputSchema, write: true, readOnly: true}),
  tool("previewSiteFile", operations.previewSiteFileOperation, {}, {input: schemas.apiSiteFilePreviewInputSchema, write: true, readOnly: true}),
  tool("publishSiteFile", operations.publishSiteFileOperation, {siteFileId: id}, {write: true}),
  tool("resetSiteFile", operations.resetSiteFileOperation, {siteFileId: id}, {write: true}),
];
