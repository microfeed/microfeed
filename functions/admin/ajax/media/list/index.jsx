import {createMediaService} from "../../../../../edge-src/models/MediaService";
import {createMediaStore} from "../../../../../edge-src/models/MediaStore";
import {projectPrefix} from "../../../../../common-src/R2Utils";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestGet({request, env}) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page'), 10) || 1;
  // Default to a high limit: the explorer builds its folder tree client-side
  // from the full object list.
  const limit = parseInt(url.searchParams.get('limit'), 10) || 1000;
  const unusedOnly = url.searchParams.get('unusedOnly') === 'true';

  const mediaService = createMediaService(env, env.FEED_DB, createMediaStore(env));
  const result = await mediaService.listWithUsage({page, limit, unusedOnly});

  // The explorer strips this prefix from each key to show relative folder paths
  // (e.g. `images/x.png` instead of `<project>/<env>/images/x.png`).
  result.pathPrefix = projectPrefix(env);

  return jsonResponse(result, 200);
}
