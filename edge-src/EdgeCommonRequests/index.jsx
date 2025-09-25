import {JsonResponseBuilder, ResponseBuilder} from "../common/PageUtils";
import {STATUSES} from "../../common-src/Constants";
import {getIdFromSlug} from "../../common-src/StringUtils";
import {AwsClient} from "aws4fetch";
import {projectPrefix} from "../../common-src/R2Utils";

//
// Schema Response Builder - returns plain JSON schema
//
class SchemaResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'application/json;charset=UTF-8';
  }

  _getResponse(props) {
    const res = super._getResponse(props);

    if (props) {
      if (props.checkIsAllowed) {
        const {subscribeMethods} = this.settings;
        let notFoundRes = ResponseBuilder.notEnabledResponse(subscribeMethods, 'json');
        if (notFoundRes) {
          return notFoundRes;
        }
      }
      if (props.isValid) {
        if (!props.isValid(this.schema)) {
          return ResponseBuilder.Response404();
        }
      }
    }
    
    // Return the plain schema directly (not JSON Feed format)
    const newResponse = new Response(JSON.stringify(this.schema), res);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  }
}

//
// Fetch feed / item json
//

export async function onFetchFeedJsonRequestGet({env, request}, checkIsAllowed = true) {
  const schemaResponseBuilder = new SchemaResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await schemaResponseBuilder.getResponse({checkIsAllowed});
}

export async function onFetchItemRequestGet({params, env, request}, checkIsAllowed = true, statuses = null) {
  const {slug, itemId} = params;
  const theItemId = itemId || getIdFromSlug(slug);

  if (theItemId) {
    const schemaResponseBuilder = new SchemaResponseBuilder(env, request, {
      queryKwargs: {
        id: theItemId,
        'status__in': statuses || [STATUSES.PUBLISHED, STATUSES.UNLISTED],
      },
      limit: 1,
    });
    return schemaResponseBuilder.getResponse({
      isValid: (schema) => {
        const item = schema.items && schema.items.length > 0 ? schema.items[0] : null;
        if (!item) {
          return false;
        }
        return true;
      },
      checkIsAllowed,
    });
  }
  return ResponseBuilder.Response404();
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
export async function onGetR2PresignedUrlRequestPost({inputParams, env}) {
  const presignedUrl = await getPresignedUrlFromR2(env, env.R2_PUBLIC_BUCKET, inputParams);
  return {
    presignedUrl,
    mediaBaseUrl: projectPrefix(env),
  };
}
