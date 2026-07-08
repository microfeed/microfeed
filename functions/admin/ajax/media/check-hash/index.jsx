import MediaRepo from "../../../../../edge-src/models/MediaRepo";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestPost({request, env}) {
  const body = await request.json();
  const hash = body && body.hash;

  const mediaRepo = new MediaRepo(env.FEED_DB);
  const existing = hash ? await mediaRepo.getByContentHash(hash) : null;

  if (existing) {
    return jsonResponse({deduped: true, url: existing.url, id: existing.id}, 200);
  }

  return jsonResponse({deduped: false}, 200);
}
