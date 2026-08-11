import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  apiChannelInputSchema,
  apiIdempotencyKeySchema,
  apiItemInputSchema,
  apiSearchQuerySchema,
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
  type ItemSearchResponse,
  ItemSearchUnavailableError,
  searchItems,
} from "@/server/items/search";
import type {
  ItemSearchField,
  ItemSearchStatus,
} from "@/shared/ItemSearch";

export const getApiFeed: APIRoute = ({request}) =>
  jsonFeedResponse(request, false, undefined, undefined, false);

export const headApiFeed: APIRoute = () => publicFeedHead();

function publicSearchResponse(response: ItemSearchResponse) {
  return {
    items: response.items.map((item) => ({
      content_text: item.content_text,
      date_modified: item.date_modified,
      date_published: item.date_published,
      date_published_ms: item.date_published_ms,
      highlights: item.highlights,
      id: item.id,
      ...(item.image ? {image: item.image} : {}),
      status: item.status,
      title: item.title,
      url: item.web_url,
    })),
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
    const response = await searchItems(locals.feedDb.FEED_DB, request, {
      datePublishedMsGt: parsed.data.date_published_ms_gt,
      datePublishedMsLt: parsed.data.date_published_ms_lt,
      fields,
      limit: parsed.data.limit,
      nextCursor: parsed.data.next_cursor,
      publicBucketUrl: locals.publicBucketUrl,
      query: parsed.data.q,
      statuses,
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
