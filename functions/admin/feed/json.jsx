import Feed from "../../../edge-src/models/Feed";

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const jsonData = await feed.getContent();
  return new Response(JSON.stringify(jsonData), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
