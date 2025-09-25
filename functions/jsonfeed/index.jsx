import {SchemaJsonFeedResponseBuilder} from "../../edge-src/common/PageUtils";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({env, request}) {
  const jsonFeedResponseBuilder = new SchemaJsonFeedResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await jsonFeedResponseBuilder.getResponse({checkIsAllowed: true});
}

export function onRequestHead() {
  return new Response('ok');
}
