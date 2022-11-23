// import Feed from "../../../edge-src/models/Feed";
import FeedDb from "../../../edge-src/models/FeedDb";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const jsonData = await feed.getContent();
  return new Response(JSON.stringify(jsonData), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
