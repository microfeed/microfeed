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

/**
 * Replace an existing media object's bytes in place. The client has already
 * PUT the new file to the SAME r2 key (via /admin/ajax/r2-ops with that key),
 * so every reference to the unchanged url now serves the new file. This only
 * refreshes the row's derived metadata.
 */
export async function onRequestPost({request, env}) {
  const body = await request.json() || {};
  const {id, hash, size, contentType, width, height} = body;
  if (!id) {
    return jsonResponse({error: 'id is required'}, 400);
  }

  const mediaService = createMediaService(env, env.FEED_DB, createMediaStore(env));
  const result = await mediaService.replaceObject(id, {hash, size, contentType, width, height});
  if (result && result.error) {
    return jsonResponse(result, 404);
  }
  return jsonResponse(result, 200);
}
