import FeedDb from "../../../edge-src/models/FeedDb";

export async function onRequestPost({request, env}) {
  const updatedFeed = await request.json();
  const feed = new FeedDb(env, request);
  await feed.putContent(updatedFeed);

  return Response.redirect('http://127.0.0.1:8788/');
  // return new Response(JSON.stringify({}), {
  //   headers: {
  //     'content-type': 'application/json;charset=UTF-8',
  //   },
  // });
}
