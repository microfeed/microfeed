import {onGetR2PresignedUrlRequestPost} from "../../../../edge-src/EdgeCommonRequests";
import {randomHex, urlJoinWithRelative} from "../../../../common-src/StringUtils";

/**
 * How to upload a file to R2 via microfeed API:
 * 1) Get presigned url via
 *    curl -X POST $microfeed_url/api/media_files/presigned_urls/ \
 *      -H "Content-Type: application/json" \
 *      -d '{"item_id": "3a0ydRs15gZ", "category": "image", "full_local_file_path": "$FULL_LOCAL_FILE_PATH"}'
 *
 * 2) Upload file to presigned url
 *    curl -X PUT -T $FULL_LOCAL_FILE_PATH $PRESIGNED_URL
 */
export async function onRequestPost(context) {
  const {request, env, data} = context;
  const {publicBucketUrl} = data;
  const jsonInputParams = await request.json();
  let error;
  let status = 201;
  let r2ObjectKey;

  if (!jsonInputParams) {
    status = 400;
    error = 'You have to provide json input params: ' +
      '{"category": "image", "full_local_file_path": "/tmp/1.png"}, where category is one of: ' +
      'image, audio, video, and document';
  } else {
    const {category, full_local_file_path, item_id} = jsonInputParams;
    if (!['image', 'audio', 'video', 'document'].includes(category)) {
      status = 400;
      error = `Invalid category: ${category}. ` +
          'Category must be one of: image, audio, video, document';
    } else if (!full_local_file_path) {
      status = 400;
      error = 'You have to provide full_local_file_path, e.g., /tmp/1.png';
    } else if (category !== 'image' && !item_id) {
      status = 400;
      error = 'You have to provide item_id for non-image categories, e.g., ' +
        '{"item_id": "3a0ydRs15gZ", "category": "audio", "full_local_file_path": "$FULL_LOCAL_FILE_PATH"}';
    }
    // TODO: check if file extension is valid, per ENCLOSURE_CATEGORIES_DICT

    let fileNamePrefix = item_id ? category: 'item';
    let folderPrefix = item_id ? 'media' : 'images';

    // TODO: make a function to build remote filename from a local file path
    const extension = full_local_file_path.slice((full_local_file_path.lastIndexOf(".") - 1 >>> 0) + 2);
    let newFilename = `${fileNamePrefix}-${randomHex(32)}`;
    if (extension && extension.length > 0) {
      newFilename += `.${extension}`;
    }
    r2ObjectKey = `${folderPrefix}/${newFilename}`;
  }

  if (error) {
    return new Response(JSON.stringify({error}), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
      status,
    });
  }

  const inputParams = {
    key: r2ObjectKey,
  };
  // TODO: for response, construct full cdn url
  const jsonData = await onGetR2PresignedUrlRequestPost({inputParams, env});
  const resultJson = {
    presigned_url: jsonData.presignedUrl,

    // Users can pass media_url to
    // 1) image & attachment.url for PUT /api/items/[itemId] or
    // 2) icon for PUT /api/channels/primary/
    media_url: urlJoinWithRelative(publicBucketUrl, `${jsonData.mediaBaseUrl}/${r2ObjectKey}`),
  };
  return new Response(JSON.stringify(resultJson), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status: 201,
  });
}
