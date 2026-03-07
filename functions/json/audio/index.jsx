import FeedDb from "../../../edge-src/models/FeedDb";
import {onFetchFeedJsonRequestGet} from "../../../edge-src/EdgeCommonRequests";

export async function onRequestGet({env, request}) {
  const feedDb = new FeedDb(env, request);
  const type = await feedDb.getItemTypeBySlug('podcast');
  if (!type) {
    return new Response('Not Found', {status: 404});
  }
  return await onFetchFeedJsonRequestGet({env, request}, true, {
    type_id: type.id,
  });
}

export function onRequestHead() {
  return new Response('ok');
}
