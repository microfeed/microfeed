import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  apiChannelInputSchema,
  apiItemInputSchema,
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
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";
import {createSignedUpload} from "@/server/media/uploads";

export const getApiFeed: APIRoute = ({request}) =>
  jsonFeedResponse(request, false, undefined, undefined, false);

export const headApiFeed: APIRoute = () => publicFeedHead();

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
  const id = await createItemRecord(locals.feedCrud, parsed.data);
  return jsonResponse({id}, {status: 201});
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
