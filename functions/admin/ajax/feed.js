import Feed from '../../../edge-src/models/Feed';

export async function onRequestPost({request, env}) {
  const updatedFeed = await request.json();
  const feed = new Feed(env, request);
  await feed.putContent(updatedFeed);

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
