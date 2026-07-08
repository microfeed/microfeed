import {STATUSES} from "../../../../common-src/Constants";
import {serializeItemForFeed} from "../../../../edge-src/models/FeedItemSerializer";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

export async function onRequestGet({ request, data }) {
  const url = new URL(request.url);
  const contentType = url.searchParams.get('content_type');
  const contentTypes = url.searchParams.get('content_type__in');

  const { feedCrud } = data;
  const queryKwargs = {
    'status__!=': STATUSES.DELETED,
  };
  if (contentTypes) {
    queryKwargs.content_type__in = contentTypes.split(',').map((entry) => entry.trim()).filter(Boolean);
  } else if (contentType) {
    queryKwargs.content_type = contentType;
  }

  const response = await feedCrud.itemRepo.list({ queryKwargs });
  const items = (response.results || []).map((row) => serializeItemForFeed(row));

  return jsonResponse({ items }, 200);
}

export async function onRequestPost({ request, data }) {
  const body = await request.json();
  const { content_type: contentType, ...payload } = body || {};

  if (!contentType) {
    return jsonResponse({
      errors: [{ field: 'content_type', message: 'content_type is required' }],
    }, 400);
  }

  const { feedCrud } = data;
  const result = await feedCrud.create(contentType, payload);

  if (result && result.errors) {
    return jsonResponse({ errors: result.errors }, 400);
  }

  return jsonResponse({ id: result }, 201);
}
