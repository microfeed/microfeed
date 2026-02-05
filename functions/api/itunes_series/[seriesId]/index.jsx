import FeedDb from "../../../../edge-src/models/FeedDb";
import {buildItemSlug} from "../../../../common-src/StringUtils";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestPut({env, request, params}) {
  const feedDb = new FeedDb(env, request);
  const {seriesId} = params;
  const body = await request.json();
  if (!body || !body.name) {
    return jsonResponse({error: 'name is required'}, 400);
  }
  const slug = buildItemSlug(body.slug || body.name);
  const description = body.description || '';
  const image = body.image || '';
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : (body.sortOrder || 0);
  await feedDb.FEED_DB.prepare(
    'UPDATE itunes_series SET updated_at = ?1, name = ?2, slug = ?3, description = ?4, image = ?5, sort_order = ?6 WHERE id = ?7'
  ).bind(
    (new Date()).toISOString(),
    body.name,
    slug,
    description,
    image,
    sortOrder,
    seriesId
  ).run();
  return jsonResponse({});
}

export async function onRequestDelete({env, request, params}) {
  const feedDb = new FeedDb(env, request);
  const {seriesId} = params;
  await feedDb.FEED_DB.prepare('DELETE FROM itunes_series WHERE id = ?1').bind(seriesId).run();
  return jsonResponse({});
}
