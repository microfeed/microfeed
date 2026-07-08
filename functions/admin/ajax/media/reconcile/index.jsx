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

export async function onRequestPost({env}) {
  const mediaService = createMediaService(env, env.FEED_DB, createMediaStore(env));
  const result = await mediaService.reconcileFromR2();

  return jsonResponse(result, 200);
}
