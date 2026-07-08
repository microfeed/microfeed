function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
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
