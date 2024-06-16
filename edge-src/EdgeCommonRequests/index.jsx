import { JsonResponseBuilder } from "../common/PageUtils";
import { STATUSES } from "../../common-src/Constants";
import { getIdFromSlug } from "../../common-src/StringUtils";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { projectPrefix } from "../../common-src/R2Utils";

//
// Fetch feed / item json
//

export async function onFetchFeedJsonRequestGet({ env, request }, checkIsAllowed = true) {
  const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await jsonResponseBuilder.getResponse({ checkIsAllowed });
}

export async function onFetchItemRequestGet({ params, env, request }, checkIsAllowed = true, statuses = null) {
  const { slug, itemId } = params;
  const theItemId = itemId || getIdFromSlug(slug);

  if (theItemId) {
    const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
      queryKwargs: {
        id: theItemId,
        'status__in': statuses || [STATUSES.PUBLISHED, STATUSES.UNLISTED],
      },
      limit: 1,
    });
    return jsonResponseBuilder.getResponse({
      isValid: (jsonData) => {
        const item = jsonData.items && jsonData.items.length > 0 ? jsonData.items[0] : null;
        if (!item) {
          return false;
        }
        return true;
      },
      checkIsAllowed,
    });
  }
  return JsonResponseBuilder.Response404();
}

//
// Fetch presigned url from R2
//

async function getPresignedUrlFromR2(env, bucket, inputParams) {
  const { key } = inputParams;
  const accessKeyId = `${env.R2_ACCESS_KEY_ID}`;
  const secretAccessKey = `${env.R2_SECRET_ACCESS_KEY}`;
  const endpoint = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = "auto"; // Use appropriate region

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint,
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `${projectPrefix(env)}/${key}`,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return presignedUrl;
}

/**
 * inputParams is a json:
 * {
 *   "key": "images/item-472d74ac4df2bedd120dd49dd83c7e44.png"
 * }
 *
 * "key" format:
 * - Cover image: images/item-<uuid4>.<ext>
 * - Media image: media/image-<uuid4>.<ext>
 * - Media audio: media/audio-<uuid4>.<ext>
 * - Media video: media/video-<uuid4>.<ext>
 * - Media document: media/document-<uuid4>.<ext>
 *
 * Response json:
 * {
 *   "presignedUrl": "<full-presigned-url>?X-Amz-Expires=86400&...",
 *   "mediaBaseUrl": "<pages-project-name>>/<environment>"
 * }
 */
export async function onGetR2PresignedUrlRequestPost({ inputParams, env }) {
  const presignedUrl = await getPresignedUrlFromR2(env, env.R2_PUBLIC_BUCKET, inputParams);
  return {
    presignedUrl,
    mediaBaseUrl: projectPrefix(env),
  };
}
