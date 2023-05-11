import {onFetchItemRequestGet} from "../../../../edge-src/EdgeCommonRequests";

export async function onRequestGet({params, env, request}) {
  return await onFetchItemRequestGet({params, env, request});
}

export function onRequestHead() {
  return new Response('ok');
}
