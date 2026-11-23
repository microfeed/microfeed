import {ContentCustomizationError} from "@/shared/Seo";
import {TagRequestError, TagConflictError} from "@/shared/Tags";
import {resolveItemTagAssignment} from "@/server/tags/service";
import {env} from "cloudflare:workers";
import {contentResult, feedResult, type ContentOperation} from "./operation";

import {
  apiChannelInputSchema,
  apiIdempotencyKeySchema,
  apiItemInputSchema,
  apiPageCreateInputSchema,
  apiPageInputSchema,
  pageInputErrorMessage,
  apiSearchQuerySchema,
  apiSiteFileInputSchema,
  apiSiteFilePreviewInputSchema,
  apiUploadInputSchema,
} from "@/shared/ApiSchemas";
import {STATUSES} from "@/shared/Constants";
import {
  getIdFromSlug,
  randomHex,
  resolvePublicBucketUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {jsonFeedData, JSON_FEED_HEADERS} from "@/server/feed/responses";
import {
  createItem as createItemRecord,
  deleteItem as deleteItemRecord,
  updateItem as updateItemRecord,
} from "@/server/items/service";
import {
  claimItemCreateIdempotency,
  completeItemCreateIdempotency,
  ItemCreateIdempotencyConflictError,
} from "@/server/items/idempotency";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";
import {createSignedUpload} from "@/server/media/uploads";
import {
  ItemSearchRequestError,
  type ContentSearchResponse,
  ItemSearchUnavailableError,
  searchContent,
} from "@/server/items/search";
import type {
  ItemSearchField,
  ItemSearchStatus,
} from "@/shared/ItemSearch";
import {validatePageSlug} from "@/shared/Pages";
import {
  siteFileMediaTypeForName,
  validateSiteFilename,
} from "@/shared/SiteFiles";
import {
  createPage,
  deletePage,
  getPageById,
  listPages,
  PageConflictError,
  PageRequestError,
  PageThemeUnsupportedError,
  updatePage,
} from "@/server/pages/service";
import {
  createSiteFile,
  deleteSiteFile,
  getSiteFileById,
  listSiteFiles,
  previewSiteFile,
  publishSiteFile,
  resetSiteFile,
  SiteFileConflictError,
  SiteFileRequestError,
  updateSiteFile,
} from "@/server/site-files/service";
import {
  changedWebhookFields,
  contentMutationWebhookCommit,
  singleWebhookEventCommit,
  webhookItemObject,
} from "@/server/webhooks/emission";
import {webhookChannelSnapshot} from "@/shared/WebhookExamples";

export const getFeedOperation: ContentOperation = async ({request, query}) => {
  const data = await jsonFeedData(request, false, undefined, undefined, false, query);
  return data instanceof Response ? feedResult(data) : contentResult(data, {headers: JSON_FEED_HEADERS});
};


function publicSearchResponse(response: ContentSearchResponse) {
  return {
    items: response.items.map((item) => item.type === "tag" ? {
      id: item.id, slug: item.slug, title: item.title, content_text: item.content_text,
      date_modified: item.date_modified, highlights: item.highlights, type: "tag" as const, url: item.web_url,
    } : item.type === "page"
      ? {
          content_text: item.content_text,
          date_modified: item.date_modified,
          ...(item.date_published
            ? {date_published: item.date_published}
            : {}),
          highlights: item.highlights,
          id: item.id,
          is_not_found_page: item.is_not_found_page,
          ...(item.meta_description
            ? {meta_description: item.meta_description}
            : {}),
          navigation_label: item.navigation_label,
          navigation_order: item.navigation_order,
          show_in_navigation: item.show_in_navigation,
          slug: item.slug,
          status: item.status,
          title: item.title,
          type: "page" as const,
          url: item.web_url,
        }
      : {
          content_text: item.content_text,
          date_modified: item.date_modified,
          date_published: item.date_published,
          date_published_ms: item.date_published_ms,
          highlights: item.highlights,
          id: item.id,
          ...(item.image ? {image: item.image} : {}),
          status: item.status,
          title: item.title,
          type: "item" as const,
          url: item.web_url,
        }),
    ...(response.next_cursor ? {next_cursor: response.next_cursor} : {}),
  };
}

export const searchItemsOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiSearchQuerySchema.safeParse(
    Object.fromEntries(context.query),
  );
  if (!parsed.success) {
    return contentResult({error: "Invalid search query."}, {status: 400});
  }
  try {
    const fields = [...new Set(parsed.data.fields.split(","))] as ItemSearchField[];
    const statuses = [...new Set(parsed.data.status.split(","))] as ItemSearchStatus[];
    const types = [...new Set(parsed.data.types.split(","))].map((type) =>
      type === "tags" ? "tag" as const : type === "pages" ? "page" as const : "item" as const
    );
    const response = await searchContent(locals.feedDb.FEED_DB, request, {
      datePublishedMsGt: parsed.data.date_published_ms_gt,
      datePublishedMsLt: parsed.data.date_published_ms_lt,
      fields,
      limit: parsed.data.limit,
      nextCursor: parsed.data.next_cursor,
      publicBucketUrl: locals.publicBucketUrl,
      query: parsed.data.q,
      statuses,
      types,
    });
    return contentResult(publicSearchResponse(response), {
      headers: {"cache-control": "private, no-store"},
    });
  } catch (error) {
    if (error instanceof ItemSearchRequestError) {
      return contentResult({error: error.message}, {status: 400});
    }
    if (error instanceof ItemSearchUnavailableError) {
      return contentResult({error: error.message}, {status: 503});
    }
    throw error;
  }
};

function pageServiceError(error: unknown): import("./operation").ContentResult | undefined {
  if (error instanceof PageRequestError) {
    return contentResult({error: error.message}, {status: 400});
  }
  if (error instanceof PageConflictError) {
    return contentResult({error: error.message}, {status: 409});
  }
  if (error instanceof PageThemeUnsupportedError) {
    return contentResult({error: error.message}, {status: 422});
  }
  return undefined;
}

export const listPagesOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const query = context.query;
  const limit = Number(query.get("limit") ?? 20);
  const statuses = (query.get("status") ??
    "published,unlisted,unpublished").split(",");
  if (
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    statuses.some((status) =>
      status !== "published" && status !== "unlisted" &&
      status !== "unpublished"
    )
  ) {
    return contentResult({error: "Invalid Page list query."}, {status: 400});
  }
  try {
    return contentResult(await listPages(locals.feedDb, request, {
      limit,
      nextCursor: query.get("next_cursor") ?? undefined,
      statuses: statuses as Array<"published" | "unlisted" | "unpublished">,
    }));
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const createPageOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiPageCreateInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult(
      {error: pageInputErrorMessage(parsed.error)},
      {status: 400},
    );
  }
  try {
    const page = await createPage(locals.feedDb, request, parsed.data, {
      adminPath: env.MICROFEED_ADMIN_PATH,
      commit: contentMutationWebhookCommit(env, request, {
        context: {origin: context.origin},
        id: (result) => result.id,
        kind: "page",
        mutation: "created",
      }),
    });
    return contentResult({id: page.id}, {status: 201});
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const validatePageOperation: ContentOperation = async (context) => {
  const parsed = apiPageCreateInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult(
      {error: pageInputErrorMessage(parsed.error)},
      {status: 400},
    );
  }
  const slugError = validatePageSlug(
    parsed.data.slug,
    env.MICROFEED_ADMIN_PATH,
  );
  if (slugError) {
    return contentResult({error: slugError}, {status: 400});
  }
  return contentResult({valid: true});
};

export const getPageOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.pageId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const page = await getPageById(locals.feedDb.FEED_DB, request, params.pageId);
  return page
    ? contentResult(page)
    : contentResult({error: "Page not found."}, {status: 404});
};

export const updatePageOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.pageId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiPageInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult(
      {error: pageInputErrorMessage(parsed.error)},
      {status: 400},
    );
  }
  try {
    const before = await getPageById(
      locals.feedDb.FEED_DB,
      request,
      params.pageId,
    );
    const page = await updatePage(
      locals.feedDb,
      request,
      params.pageId,
      parsed.data,
      {
        adminPath: env.MICROFEED_ADMIN_PATH,
        commit: contentMutationWebhookCommit(env, request, {
          before: before as unknown as Record<string, unknown> | null,
          context: {origin: context.origin},
          id: params.pageId,
          kind: "page",
          mutation: "updated",
        }),
      },
    );
    if (!page) return contentResult({error: "Page not found."}, {status: 404});
    return contentResult(page);
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const deletePageOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.pageId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  try {
    const before = await getPageById(
      locals.feedDb.FEED_DB,
      request,
      params.pageId,
    );
    if (!await deletePage(
      locals.feedDb,
      params.pageId,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: context.origin},
        id: params.pageId,
        kind: "page",
        mutation: "deleted",
      }),
    )) {
      return contentResult({error: "Page not found."}, {status: 404});
    }
    return contentResult({});
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

function siteFileServiceError(error: unknown): import("./operation").ContentResult | undefined {
  if (error instanceof SiteFileRequestError) {
    return contentResult({error: error.message}, {status: 400});
  }
  if (error instanceof SiteFileConflictError) {
    return contentResult({error: error.message}, {status: 409});
  }
  return undefined;
}

export const listSiteFilesOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  return contentResult({
    items: await listSiteFiles(locals.feedDb.FEED_DB, request),
  });
};

export const createSiteFileOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiSiteFileInputSchema.safeParse(context.input);
  if (!parsed.success || !parsed.data.filename) {
    return contentResult({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const siteFile = await createSiteFile(
      locals.feedDb,
      request,
      parsed.data,
      contentMutationWebhookCommit(env, request, {
        context: {origin: context.origin},
        id: (result) => result.id,
        kind: "site_file",
        mutation: "created",
      }),
    );
    return contentResult({id: siteFile.id}, {status: 201});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const validateSiteFileOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiSiteFileInputSchema.safeParse(context.input);
  if (!parsed.success || !parsed.data.filename) {
    return contentResult({error: "Invalid Site File."}, {status: 400});
  }
  const contentType = parsed.data.content_type ??
    siteFileMediaTypeForName(parsed.data.filename);
  if (validateSiteFilename(parsed.data.filename) || !contentType) {
    return contentResult({error: "Invalid Site File."}, {status: 400});
  }
  try {
    await previewSiteFile(locals.feedDb, request, {
      ...parsed.data,
      content_type: contentType,
      draft_content: parsed.data.draft_content ?? "",
    });
    return contentResult({valid: true});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const previewSiteFileOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiSiteFilePreviewInputSchema.safeParse(
    context.input,
  );
  if (!parsed.success || (!parsed.data.filename && !parsed.data.site_file_id)) {
    return contentResult({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const preview = await previewSiteFile(
      locals.feedDb,
      request,
      parsed.data,
    );
    return preview
      ? contentResult(preview, {
          headers: {"cache-control": "private, no-store"},
        })
      : contentResult({error: "Site File not found."}, {status: 404});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const getSiteFileOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.siteFileId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const siteFile = await getSiteFileById(
    locals.feedDb.FEED_DB,
    request,
    params.siteFileId,
  );
  return siteFile
    ? contentResult(siteFile)
    : contentResult({error: "Site File not found."}, {status: 404});
};

export const updateSiteFileOperation: ContentOperation = async (context) => {
  const {
  locals,
  params,
  request,
} = context;
  if (!locals.feedDb || !params.siteFileId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiSiteFileInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const before = await getSiteFileById(
      locals.feedDb.FEED_DB,
      request,
      params.siteFileId,
    );
    const siteFile = await updateSiteFile(
      locals.feedDb,
      request,
      params.siteFileId,
      parsed.data,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: context.origin},
        id: params.siteFileId,
        kind: "site_file",
        mutation: "updated",
      }),
    );
    if (!siteFile) {
      return contentResult({error: "Site File not found."}, {status: 404});
    }
    return contentResult(siteFile);
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteSiteFileOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.siteFileId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  try {
    const before = await getSiteFileById(
      locals.feedDb.FEED_DB,
      request,
      params.siteFileId,
    );
    if (!await deleteSiteFile(
      locals.feedDb,
      params.siteFileId,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: context.origin},
        id: params.siteFileId,
        kind: "site_file",
        mutation: "deleted",
      }),
    )) {
      return contentResult({error: "Site File not found."}, {status: 404});
    }
    return contentResult({});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

async function mutateSiteFileOperation(
  context: Parameters<ContentOperation>[0],
  action: typeof publishSiteFile | typeof resetSiteFile,
): Promise<import("./operation").ContentResult> {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.siteFileId) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  try {
    const siteFile = await action(
      locals.feedDb,
      request,
      params.siteFileId,
      singleWebhookEventCommit(env, request, (result) => ({
        object: result as unknown as Record<string, unknown>,
        subjectId: result.id,
        subjectType: "site_file",
        type: action === publishSiteFile
          ? "site_file.published"
          : "site_file.reset",
      }), {origin: context.origin}),
    );
    if (!siteFile) {
      return contentResult({error: "Site File not found."}, {status: 404});
    }
    return contentResult(siteFile);
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
}

export const publishSiteFileOperation: ContentOperation = (context) =>
  mutateSiteFileOperation(context, publishSiteFile);

export const resetSiteFileOperation: ContentOperation = (context) =>
  mutateSiteFileOperation(context, resetSiteFile);

const createItemUncheckedOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!locals.feedCrud || !locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult({error: "Invalid item."}, {status: 400});
  }
  const rawIdempotencyKey = context.idempotencyKey ?? null;
  if (rawIdempotencyKey === null) {
    const id = await createItemRecord(
      locals.feedCrud,
      parsed.data,
      undefined,
      contentMutationWebhookCommit(env, request, {
        context: {origin: context.origin},
        id: (item) => String(item.id),
        kind: "item",
        mapResult: webhookItemObject,
        mutation: "created",
      }),
    );
    return contentResult({id}, {status: 201});
  }
  const idempotencyKey = apiIdempotencyKeySchema.safeParse(
    rawIdempotencyKey,
  );
  if (!idempotencyKey.success) {
    return contentResult({error: "Invalid Idempotency-Key."}, {status: 400});
  }
  if (!locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }

  let claim;
  try {
    claim = await claimItemCreateIdempotency(
      locals.feedDb.FEED_DB,
      idempotencyKey.data,
      parsed.data,
    );
  } catch (error) {
    if (error instanceof ItemCreateIdempotencyConflictError) {
      return contentResult({error: error.message}, {status: 409});
    }
    throw error;
  }

  if (!claim.completed && !await locals.feedDb.getItemById(claim.itemId)) {
    await createItemRecord(
      locals.feedCrud,
      parsed.data,
      claim.itemId,
      contentMutationWebhookCommit(env, request, {
        context: {origin: context.origin},
        id: claim.itemId,
        kind: "item",
        mapResult: webhookItemObject,
        mutation: "created",
      }),
    );
  }
  if (!claim.completed) {
    await completeItemCreateIdempotency(
      locals.feedDb.FEED_DB,
      claim.keyHash,
    );
  }
  return contentResult({id: claim.itemId}, {
    headers: claim.replay ? {"Idempotency-Replayed": "true"} : undefined,
    status: 201,
  });
};

export const validateItemOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  const parsed = apiItemInputSchema.safeParse(context.input);
  if (!parsed.success) return contentResult({error: "Invalid item."}, {status: 400});
  if (parsed.data.tag_ids !== undefined || parsed.data.tag_slugs !== undefined) {
    if (!locals.feedDb) return contentResult({error: "Feed context unavailable"}, {status: 500});
    try {
      await resolveItemTagAssignment(locals.feedDb.FEED_DB, new URL(request.url).origin, parsed.data);
    } catch (error) {
      if (error instanceof TagRequestError) return contentResult({error: error.message, field: error.field}, {status: 400});
      throw error;
    }
  }
  return contentResult({valid: true});
};

export const getItemOperation: ContentOperation = async ({params, request}) => {
  const data = await jsonFeedData(request, false, params.itemId,
    [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED], false);
  return data instanceof Response ? feedResult(data) : contentResult(data, {headers: JSON_FEED_HEADERS});
};

export const deleteItemOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return contentResult({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const before = await locals.feedDb.getItemById(itemId);
  if (!await deleteItemRecord(
    locals.feedDb,
    locals.feedCrud,
    itemId,
    contentMutationWebhookCommit(env, request, {
      before: before ? webhookItemObject(before) : null,
      context: {origin: context.origin},
      id: itemId,
      kind: "item",
      mapResult: webhookItemObject,
      mutation: "deleted",
    }),
  )) {
    return contentResult({error: "Item not found."}, {status: 404});
  }
  return contentResult({});
};

const updateItemUncheckedOperation: ContentOperation = async (context) => {
  const {locals, params, request} = context;
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return contentResult({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult({error: "Invalid item."}, {status: 400});
  }
  const before = await locals.feedDb.getItemById(itemId);
  const item = await updateItemRecord(
    locals.feedDb,
    locals.feedCrud,
    itemId,
    parsed.data,
    contentMutationWebhookCommit(env, request, {
      before: before ? webhookItemObject(before) : null,
      context: {origin: context.origin},
      id: itemId,
      kind: "item",
      mapResult: webhookItemObject,
      mutation: "updated",
    }),
  );
  if (!item) {
    return contentResult({error: "Item not found."}, {status: 404});
  }
  const publicFeed = await locals.feedDb.getPublicJsonData({
    ...locals.feedCrud.feedContent,
    items: [item],
  }, true) as {items?: unknown[]};
  const object = (publicFeed.items?.[0] ?? {}) as Record<string, unknown>;
  return contentResult(object);
};

const updatePrimaryChannelUncheckedOperation: ContentOperation = async (context) => {
  const {
  locals,
  params,
  request,
} = context;
  if (params.channelId !== "primary") {
    return contentResult({error: "Invalid channel id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return contentResult({error: "Feed context unavailable"}, {status: 500});
  }
  const parsed = apiChannelInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult({error: "Invalid channel."}, {status: 400});
  }
  const before = webhookChannelSnapshot(structuredClone(
    (locals.feedCrud.feedContent.channel ?? {}) as Record<string, unknown>,
  ));
  await locals.feedCrud.upsertChannel(
    parsed.data,
    singleWebhookEventCommit(env, request, (after) => {
      const object = webhookChannelSnapshot(after);
      const changedFields = changedWebhookFields(before, object);
      return changedFields.length > 0
        ? {
            changedFields,
            object,
            subjectId: "primary",
            subjectType: "channel",
            type: "channel.updated",
          }
        : null;
    }, {origin: context.origin}),
  );
  return contentResult({});
};

export const prepareMediaUploadOperation: ContentOperation = async (context) => {
  const {locals, request} = context;
  if (!mediaBucket(env)) {
    return feedResult(mediaStorageUnavailableResponse());
  }
  const parsed = apiUploadInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return contentResult({
      error: "Provide a valid media upload request.",
    }, {status: 400});
  }
  const input = parsed.data;
  const {
    category,
    full_local_file_path: localPath,
    item_id: itemId,
  } = input;
  if (category !== "image" && !itemId) {
    return contentResult({
      error: "You have to provide item_id for non-image categories.",
    }, {status: 400});
  }

  const extension = localPath.slice(
    (localPath.lastIndexOf(".") - 1 >>> 0) + 2,
  );
  const filenamePrefix = itemId ? category : "item";
  const folderPrefix = itemId ? "media" : "images";
  const filename = `${filenamePrefix}-${randomHex(32)}` +
    (extension ? `.${extension}` : "");
  const key = `${folderPrefix}/${filename}`;
  const signed = await createSignedUpload(request, env, {
    key,
    size: input.size,
    type: input.type,
  });
  const relativeMediaPath = `${signed.mediaBaseUrl}/${key}`;
  const configuredBase = resolvePublicBucketUrl(
    locals.publicBucketUrl,
    new URL(request.url).hostname,
  );
  const joinedMediaUrl = urlJoinWithRelative(
    configuredBase,
    relativeMediaPath,
    request.url,
  );
  const mediaUrl = joinedMediaUrl?.startsWith("/")
    ? new URL(joinedMediaUrl, request.url).toString()
    : joinedMediaUrl;

  return contentResult({
    media_url: mediaUrl,
    presigned_url: signed.presignedUrl,
  }, {status: 201});
};

function customizationErrors(handler: ContentOperation): ContentOperation {
  return async (context) => {
    try { return await handler(context); } catch (error) {
      if (error instanceof ContentCustomizationError) return contentResult({error: error.message}, {status: error.status});
      if (error instanceof TagRequestError) return contentResult({error: error.message, field: error.field}, {status: 400});
      if (error instanceof TagConflictError) return contentResult({error: error.message}, {status: 409});
      throw error;
    }
  };
}
export const createItemOperation = customizationErrors(createItemUncheckedOperation);
export const updateItemOperation = customizationErrors(updateItemUncheckedOperation);
export const updatePrimaryChannelOperation = customizationErrors(updatePrimaryChannelUncheckedOperation);
