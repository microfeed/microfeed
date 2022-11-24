import FeedDb, {getFetchItemsParams} from "../../../edge-src/models/FeedDb";
import {STATUSES} from "../../../common-src/Constants";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);

  const jsonData = await feed.getContent(
    getFetchItemsParams(request, {
      'status__!=': STATUSES.DELETED,
    }));
  return new Response(JSON.stringify(jsonData), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
