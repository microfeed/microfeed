// import Feed from '../../../edge-src/models/Feed';
import FeedDb from "../../../edge-src/models/FeedDb";

export async function onRequestPost({request, env}) {
  const updatedFeed = await request.json();
  const feed = new FeedDb(env, request);
  await feed.putContent(updatedFeed);

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
