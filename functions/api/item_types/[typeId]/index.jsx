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
  const {typeId} = params;
  const body = await request.json();
  if (!body || !body.name) {
    return jsonResponse({error: 'name is required'}, 400);
  }
  const slug = buildItemSlug(body.slug || body.name);
  const description = body.description || '';
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : (body.sortOrder || 0);
  await feedDb.FEED_DB.prepare(
    'UPDATE item_types SET updated_at = ?1, name = ?2, slug = ?3, description = ?4, sort_order = ?5 WHERE id = ?6'
  ).bind(
    (new Date()).toISOString(),
    body.name,
    slug,
    description,
    sortOrder,
    typeId
  ).run();
  return jsonResponse({});
}

export async function onRequestDelete({env, request, params}) {
  const feedDb = new FeedDb(env, request);
  const {typeId} = params;
  await feedDb.FEED_DB.prepare('DELETE FROM item_types WHERE id = ?1').bind(typeId).run();
  return jsonResponse({});
}
