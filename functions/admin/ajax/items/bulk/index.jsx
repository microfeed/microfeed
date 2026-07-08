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
  const { action, ids = [], tagIds = [] } = body || {};

  const { feedCrud } = data;

  let result;
  switch (action) {
    case 'publish':
      result = await feedCrud.bulkPublish(ids);
      break;
    case 'unpublish':
      result = await feedCrud.bulkUnpublish(ids);
      break;
    case 'delete':
      result = await feedCrud.bulkDelete(ids);
      break;
    case 'tag':
      result = await feedCrud.bulkTag(ids, tagIds);
      break;
    default:
      return jsonResponse({
        errors: [{ field: 'action', message: 'Unknown bulk action' }],
      }, 400);
  }

  return jsonResponse(result, 200);
}
