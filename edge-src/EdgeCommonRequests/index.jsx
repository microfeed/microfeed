import {JsonResponseBuilder} from "../common/PageUtils";
import {STATUSES} from "../../common-src/Constants";
import {getIdFromSlug} from "../../common-src/StringUtils";
import {AwsClient} from "aws4fetch";
import {projectPrefix} from "../../common-src/R2Utils";

//
// Fetch feed / item json
//

export async function onFetchFeedJsonRequestGet({env, request}, checkIsAllowed = true) {
  const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await jsonResponseBuilder.getResponse({checkIsAllowed});
}

export async function onFetchItemRequestGet({params, env, request}, checkIsAllowed = true) {
  const {slug, itemId} = params;
  const theItemId = itemId || getIdFromSlug(slug);

  if (theItemId) {
    const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
      queryKwargs: {
        id: theItemId,
        'status__in': [STATUSES.PUBLISHED, STATUSES.UNLISTED],
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

async function _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region) {
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    'service': 's3',
    region,
  });

  const request = new Request(endpoint, {
    method: 'PUT',
  });

  const presigned = await aws.sign(request, { aws: { signQuery: true }})
  return presigned.url;
}

async function getPresignedUrlFromR2(env, bucket, inputParams) {
  const {
    key,
    // size,
    // type,
  } = inputParams;
  const accessKeyId = `${env.R2_ACCESS_KEY_ID}`
  const secretAccessKey = `${env.R2_SECRET_ACCESS_KEY}`;
  const endpoint = `https://${bucket}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${projectPrefix(env)}/${key}`;
  return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, 'auto');
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
export async function onGetR2PresignedUrlRequestPost({request, env}) {
  const inputParams = await request.json();
  const presignedUrl = await getPresignedUrlFromR2(env, env.R2_PUBLIC_BUCKET, inputParams);
  const jsonData = {
    presignedUrl,
    mediaBaseUrl: projectPrefix(env),
  };
  return new Response(JSON.stringify(jsonData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
