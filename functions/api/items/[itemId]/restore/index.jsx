import {getIdFromSlug} from "../../../../../common-src/StringUtils";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

function isNotFoundError(result) {
  return result?.errors?.some((error) => error.field === 'id' && error.message === 'Item not found');
}

export async function onRequestPost({ params, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId) || itemId;

  const { feedCrud } = data;
  const result = await feedCrud.restore(itemUniqId);

  if (result && result.errors) {
    const status = isNotFoundError(result) ? 404 : 400;
    return jsonResponse({ errors: result.errors }, status);
  }

  return jsonResponse({ id: result }, 200);
}
