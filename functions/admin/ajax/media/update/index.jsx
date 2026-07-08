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
  const {id, title, slug} = body;
  if (!id) {
    return jsonResponse({error: 'id is required'}, 400);
  }

  const mediaService = createMediaService(env, env.FEED_DB, createMediaStore(env));
  const result = await mediaService.updateMeta(id, {title, slug});
  if (result && result.error) {
    return jsonResponse(result, 404);
  }
  return jsonResponse(result, 200);
}
