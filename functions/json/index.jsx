import {onFetchFeedJsonRequestGet} from "../../edge-src/EdgeCommonRequests";

export async function onRequestGet({env, request}) {
  return await onFetchFeedJsonRequestGet({env, request}, true);
}

export function onRequestHead() {
  return new Response('ok');
}
