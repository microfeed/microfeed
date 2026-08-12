import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  apiChannelInputSchema,
  apiIdempotencyKeySchema,
  apiItemInputSchema,
  apiPageInputSchema,
  apiSearchQuerySchema,
  apiSiteFileInputSchema,
  apiUploadInputSchema,
} from "@/shared/ApiSchemas";
import {STATUSES} from "@/shared/Constants";
import {
  getIdFromSlug,
  randomHex,
  resolvePublicBucketUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {jsonFeedResponse, publicFeedHead} from "@/server/feed/responses";
import {jsonResponse} from "@/server/http";
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
import {slugifyPageTitle, validatePageSlug} from "@/shared/Pages";
import {
  siteFileMediaTypeForName,
  validateSiteFileContent,
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
  publishSiteFile,
  resetSiteFile,
  SiteFileConflictError,
  SiteFileRequestError,
  updateSiteFile,
} from "@/server/site-files/service";

export const getApiFeed: APIRoute = ({request}) =>
  jsonFeedResponse(request, false, undefined, undefined, false);

export const headApiFeed: APIRoute = () => publicFeedHead();

function publicSearchResponse(response: ContentSearchResponse) {
  return {
    items: response.items.map((item) => item.type === "page"
      ? {
          content_text: item.content_text,
          date_modified: item.date_modified,
          ...(item.date_published
            ? {date_published: item.date_published}
            : {}),
          highlights: item.highlights,
          id: item.id,
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

export const searchApiItems: APIRoute = async ({locals, request}) => {
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiSearchQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return jsonResponse({error: "Invalid search query."}, {status: 400});
  }
  try {
    const fields = [...new Set(parsed.data.fields.split(","))] as ItemSearchField[];
    const statuses = [...new Set(parsed.data.status.split(","))] as ItemSearchStatus[];
    const types = [...new Set(parsed.data.types.split(","))].map((type) =>
      type === "pages" ? "page" as const : "item" as const
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
    return jsonResponse(publicSearchResponse(response), {
      headers: {"cache-control": "private, no-store"},
    });
  } catch (error) {
    if (error instanceof ItemSearchRequestError) {
      return jsonResponse({error: error.message}, {status: 400});
    }
    if (error instanceof ItemSearchUnavailableError) {
      return jsonResponse({error: error.message}, {status: 503});
    }
    throw error;
  }
};

function pageServiceError(error: unknown): Response | undefined {
  if (error instanceof PageRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof PageConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  if (error instanceof PageThemeUnsupportedError) {
    return jsonResponse({error: error.message}, {status: 422});
  }
  return undefined;
}

export const listApiPages: APIRoute = async ({locals, request}) => {
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const query = new URL(request.url).searchParams;
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
    return jsonResponse({error: "Invalid Page list query."}, {status: 400});
  }
  try {
    return jsonResponse(await listPages(locals.feedDb, request, {
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

export const createApiPage: APIRoute = async ({locals, request}) => {
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiPageInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid Page."}, {status: 400});
  }
  try {
    const page = await createPage(locals.feedDb, request, parsed.data, {
      adminPath: env.MICROFEED_ADMIN_PATH,
    });
    return jsonResponse({id: page.id}, {status: 201});
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const validateApiPage: APIRoute = async ({request}) => {
  const parsed = apiPageInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  const title = parsed.success ? parsed.data.title?.trim() : "";
  const slug = parsed.success && title
    ? parsed.data.slug || slugifyPageTitle(title)
    : "";
  if (
    !parsed.success || !title ||
    validatePageSlug(slug, env.MICROFEED_ADMIN_PATH)
  ) {
    return jsonResponse({error: "Invalid Page."}, {status: 400});
  }
  return jsonResponse({valid: true});
};

export const getApiPage: APIRoute = async ({locals, params, request}) => {
  if (!locals.feedDb || !params.pageId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const page = await getPageById(locals.feedDb.FEED_DB, request, params.pageId);
  return page
    ? jsonResponse(page)
    : jsonResponse({error: "Page not found."}, {status: 404});
};

export const updateApiPage: APIRoute = async ({locals, params, request}) => {
  if (!locals.feedDb || !params.pageId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiPageInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid Page."}, {status: 400});
  }
  try {
    const page = await updatePage(
      locals.feedDb,
      request,
      params.pageId,
      parsed.data,
      {adminPath: env.MICROFEED_ADMIN_PATH},
    );
    return page
      ? jsonResponse(page)
      : jsonResponse({error: "Page not found."}, {status: 404});
  } catch (error) {
    const response = pageServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteApiPage: APIRoute = async ({locals, params}) => {
  if (!locals.feedDb || !params.pageId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  return await deletePage(locals.feedDb, params.pageId)
    ? jsonResponse({})
    : jsonResponse({error: "Page not found."}, {status: 404});
};

function siteFileServiceError(error: unknown): Response | undefined {
  if (error instanceof SiteFileRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof SiteFileConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  return undefined;
}

export const listApiSiteFiles: APIRoute = async ({locals, request}) => {
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  return jsonResponse({
    items: await listSiteFiles(locals.feedDb.FEED_DB, request),
  });
};

export const createApiSiteFile: APIRoute = async ({locals, request}) => {
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !parsed.data.filename) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const siteFile = await createSiteFile(locals.feedDb, request, parsed.data);
    return jsonResponse({id: siteFile.id}, {status: 201});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const validateApiSiteFile: APIRoute = async ({request}) => {
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !parsed.data.filename) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  const contentType = parsed.data.content_type ??
    siteFileMediaTypeForName(parsed.data.filename);
  if (
    validateSiteFilename(parsed.data.filename) || !contentType ||
    validateSiteFileContent(parsed.data.draft_content ?? "", contentType)
  ) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  return jsonResponse({valid: true});
};

export const getApiSiteFile: APIRoute = async ({locals, params, request}) => {
  if (!locals.feedDb || !params.siteFileId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const siteFile = await getSiteFileById(
    locals.feedDb.FEED_DB,
    request,
    params.siteFileId,
  );
  return siteFile
    ? jsonResponse(siteFile)
    : jsonResponse({error: "Site File not found."}, {status: 404});
};

export const updateApiSiteFile: APIRoute = async ({
  locals,
  params,
  request,
}) => {
  if (!locals.feedDb || !params.siteFileId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const siteFile = await updateSiteFile(
      locals.feedDb,
      request,
      params.siteFileId,
      parsed.data,
    );
    return siteFile
      ? jsonResponse(siteFile)
      : jsonResponse({error: "Site File not found."}, {status: 404});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteApiSiteFile: APIRoute = async ({locals, params}) => {
  if (!locals.feedDb || !params.siteFileId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  try {
    return await deleteSiteFile(locals.feedDb, params.siteFileId)
      ? jsonResponse({})
      : jsonResponse({error: "Site File not found."}, {status: 404});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
};

async function mutateApiSiteFile(
  context: Parameters<APIRoute>[0],
  action: typeof publishSiteFile | typeof resetSiteFile,
): Promise<Response> {
  const {locals, params, request} = context;
  if (!locals.feedDb || !params.siteFileId) {
    return new Response("Feed context unavailable", {status: 500});
  }
  try {
    const siteFile = await action(
      locals.feedDb,
      request,
      params.siteFileId,
    );
    return siteFile
      ? jsonResponse(siteFile)
      : jsonResponse({error: "Site File not found."}, {status: 404});
  } catch (error) {
    const response = siteFileServiceError(error);
    if (response) return response;
    throw error;
  }
}

export const publishApiSiteFile: APIRoute = (context) =>
  mutateApiSiteFile(context, publishSiteFile);

export const resetApiSiteFile: APIRoute = (context) =>
  mutateApiSiteFile(context, resetSiteFile);

export const createApiItem: APIRoute = async ({locals, request}) => {
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid item."}, {status: 400});
  }
  const rawIdempotencyKey = request.headers.get("idempotency-key");
  if (rawIdempotencyKey === null) {
    const id = await createItemRecord(locals.feedCrud, parsed.data);
    return jsonResponse({id}, {status: 201});
  }
  const idempotencyKey = apiIdempotencyKeySchema.safeParse(
    rawIdempotencyKey,
  );
  if (!idempotencyKey.success) {
    return jsonResponse({error: "Invalid Idempotency-Key."}, {status: 400});
  }
  if (!locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
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
      return jsonResponse({error: error.message}, {status: 409});
    }
    throw error;
  }

  if (!claim.completed && !await locals.feedDb.getItemById(claim.itemId)) {
    await createItemRecord(locals.feedCrud, parsed.data, claim.itemId);
  }
  if (!claim.completed) {
    await completeItemCreateIdempotency(
      locals.feedDb.FEED_DB,
      claim.keyHash,
    );
  }
  return jsonResponse({id: claim.itemId}, {
    headers: claim.replay ? {"Idempotency-Replayed": "true"} : undefined,
    status: 201,
  });
};

export const validateApiItem: APIRoute = async ({request}) => {
  const parsed = apiItemInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  return parsed.success
    ? jsonResponse({valid: true})
    : jsonResponse({error: "Invalid item."}, {status: 400});
};

export const getApiItem: APIRoute = ({params, request}) =>
  jsonFeedResponse(
    request,
    false,
    params.itemId,
    [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
    false,
  );

export const deleteApiItem: APIRoute = async ({locals, params}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  if (!await deleteItemRecord(locals.feedDb, locals.feedCrud, itemId)) {
    return jsonResponse({error: "Item not found."}, {status: 404});
  }
  return jsonResponse({});
};

export const updateApiItem: APIRoute = async ({locals, params, request}) => {
  const itemId = getIdFromSlug(params.itemId ?? "");
  if (!itemId) {
    return jsonResponse({error: "Invalid item id"}, {status: 400});
  }
  if (!locals.feedCrud || !locals.feedDb) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid item."}, {status: 400});
  }
  const item = await updateItemRecord(
    locals.feedDb,
    locals.feedCrud,
    itemId,
    parsed.data,
  );
  if (!item) {
    return jsonResponse({error: "Item not found."}, {status: 404});
  }
  const publicFeed = await locals.feedDb.getPublicJsonData({
    ...locals.feedCrud.feedContent,
    items: [item],
  }, true) as {items?: unknown[]};
  return jsonResponse(publicFeed.items?.[0] ?? {});
};

export const updateApiPrimaryChannel: APIRoute = async ({
  locals,
  params,
  request,
}) => {
  if (params.channelId !== "primary") {
    return jsonResponse({error: "Invalid channel id"}, {status: 400});
  }
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiChannelInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid channel."}, {status: 400});
  }
  await locals.feedCrud.upsertChannel(parsed.data);
  return jsonResponse({});
};

export const prepareApiMediaUpload: APIRoute = async ({locals, request}) => {
  if (!mediaBucket(env)) {
    return mediaStorageUnavailableResponse();
  }
  const parsed = apiUploadInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({
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
    return jsonResponse({
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

  return jsonResponse({
    media_url: mediaUrl,
    presigned_url: signed.presignedUrl,
  }, {status: 201});
};
