import Feed from "../../../edge-src/models/Feed";

export async function onRequestGet({env, request}) {
  const feed = new Feed(env, request);
  const jsonData = await feed.getContent();
  return new Response(JSON.stringify(jsonData), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
