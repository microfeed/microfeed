import {STATUSES} from "../../../../../common-src/Constants";
import AggregationResolver from "../../../../../edge-src/models/AggregationResolver";
import {serializeItemForFeed} from "../../../../../edge-src/models/FeedItemSerializer";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();

  const resolver = new AggregationResolver(env.FEED_DB);
  const resolved = await resolver.resolveFilter(body || {}, {
    statuses: [STATUSES.PUBLISHED, STATUSES.UNLISTED],
  });

  const items = resolved.map((row) => serializeItemForFeed(row));

  return jsonResponse({ items }, 200);
}
