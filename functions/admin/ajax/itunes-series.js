import FeedDb from "../../../edge-src/models/FeedDb";
import {buildItemSlug} from "../../../common-src/StringUtils";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestGet({env, request}) {
  const feedDb = new FeedDb(env, request);
  const res = await feedDb.FEED_DB.prepare(
    'SELECT * FROM itunes_series ORDER BY sort_order, id'
  ).all();
  return jsonResponse({items: res.results || []});
}

export async function onRequestPost({env, request}) {
  const feedDb = new FeedDb(env, request);
  const body = await request.json();
  if (!body || !body.name) {
    return jsonResponse({error: 'name is required'}, 400);
  }
  const slug = buildItemSlug(body.slug || body.name);
  const description = body.description || '';
  const image = body.image || '';
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : (body.sortOrder || 0);
  const res = await feedDb.FEED_DB.prepare(
    'INSERT INTO itunes_series (name, slug, description, image, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(body.name, slug, description, image, sortOrder).run();
  return jsonResponse({id: res.meta.last_row_id});
}

export async function onRequestPut({env, request}) {
  const feedDb = new FeedDb(env, request);
  const body = await request.json();
  if (!body || !body.id) {
    return jsonResponse({error: 'id is required'}, 400);
  }
  const slug = buildItemSlug(body.slug || body.name || '');
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
    body.id
  ).run();
  return jsonResponse({});
}

export async function onRequestDelete({env, request}) {
  const feedDb = new FeedDb(env, request);
  const body = await request.json();
  if (!body || !body.id) {
    return jsonResponse({error: 'id is required'}, 400);
  }
  await feedDb.FEED_DB.prepare('DELETE FROM itunes_series WHERE id = ?1').bind(body.id).run();
  return jsonResponse({});
}
