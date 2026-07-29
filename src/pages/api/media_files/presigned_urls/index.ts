import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  randomHex,
  resolvePublicBucketUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {jsonResponse} from "../../../../server/http";
import {createSignedUpload} from "@/server/media/uploads";

interface PresignedUrlPayload {
  category?: string;
  full_local_file_path?: string;
  item_id?: string;
  size?: number;
  type?: string;
}

const categories = ["image", "audio", "video", "document"];

export const POST: APIRoute = async ({locals, request}) => {
  const input = await request.json() as PresignedUrlPayload | null;
  if (!input) {
    return jsonResponse({
      error: "You have to provide JSON input parameters.",
    }, {status: 400});
  }
  const {
    category,
    full_local_file_path: localPath,
    item_id: itemId,
  } = input;
  if (!category || !categories.includes(category)) {
    return jsonResponse({
      error: `Invalid category: ${category}. Category must be one of: ${categories.join(", ")}`,
    }, {status: 400});
  }
  if (!localPath) {
    return jsonResponse({
      error: "You have to provide full_local_file_path, e.g., /tmp/1.png",
    }, {status: 400});
  }
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
