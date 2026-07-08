import {createMediaService} from "../../../../../edge-src/models/MediaService";
import {createMediaStore} from "../../../../../edge-src/models/MediaStore";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestPost({request, env}) {
  const body = await request.json() || {};
  const {key, url, hash, size, contentType, width, height, originalFilename, title, slug} = body;

  const mediaService = createMediaService(env, env.FEED_DB, createMediaStore(env));
  const result = await mediaService.registerUpload({hash, key, url, size, contentType, width, height, originalFilename, title, slug});

  return jsonResponse(result, 200);
}
