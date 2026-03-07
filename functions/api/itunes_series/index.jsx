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
  return jsonResponse({id: res.meta.last_row_id}, 201);
}
