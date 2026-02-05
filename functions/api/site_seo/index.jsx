import FeedDb from "../../../edge-src/models/FeedDb";

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
    'SELECT * FROM site_seo WHERE id = 1 LIMIT 1'
  ).all();
  return jsonResponse({item: res.results && res.results.length > 0 ? res.results[0] : {}});
}

export async function onRequestPut({env, request}) {
  const feedDb = new FeedDb(env, request);
  const body = await request.json();
  const values = {
    site_name: body.site_name || body.siteName || '',
    default_title: body.default_title || body.defaultTitle || '',
    default_description: body.default_description || body.defaultDescription || '',
    default_og_image: body.default_og_image || body.defaultOgImage || '',
    twitter_handle: body.twitter_handle || body.twitterHandle || '',
    logo_url: body.logo_url || body.logoUrl || '',
    language: body.language || '',
  };
  await feedDb.FEED_DB.prepare(
    'INSERT INTO site_seo (id, site_name, default_title, default_description, default_og_image, twitter_handle, logo_url, language) ' +
    'VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7) ' +
    'ON CONFLICT(id) DO UPDATE SET updated_at = ?8, site_name = ?1, default_title = ?2, default_description = ?3, ' +
    'default_og_image = ?4, twitter_handle = ?5, logo_url = ?6, language = ?7'
  ).bind(
    values.site_name,
    values.default_title,
    values.default_description,
    values.default_og_image,
    values.twitter_handle,
    values.logo_url,
    values.language,
    (new Date()).toISOString()
  ).run();
  return jsonResponse({});
}
