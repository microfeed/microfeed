import TagService from "../../../edge-src/models/TagService";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestGet({ env }) {
  const tagService = new TagService(env.FEED_DB);
  const tags = await tagService.list();

  return jsonResponse({ tags }, 200);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();

  const tagService = new TagService(env.FEED_DB);
  const result = await tagService.create(body || {});

  if (result && result.errors) {
    return jsonResponse({ errors: result.errors }, 400);
  }

  return jsonResponse({ tag: result }, 201);
}
