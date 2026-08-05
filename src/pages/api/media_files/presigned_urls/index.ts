import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  randomHex,
  resolvePublicBucketUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {jsonResponse} from "../../../../server/http";
import {createSignedUpload} from "@/server/media/uploads";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";
import {apiUploadInputSchema} from "@/shared/ApiSchemas";

export const POST: APIRoute = async ({locals, request}) => {
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
