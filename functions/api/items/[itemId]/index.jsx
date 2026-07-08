import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {STATUSES} from "../../../../common-src/Constants";
import {onFetchItemRequestGet} from "../../../../edge-src/EdgeCommonRequests";

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

export async function onRequestGet({params, env, request}) {
  return await onFetchItemRequestGet(
    {params, env, request}, false, [
      STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED]);
}

export async function onRequestPut({ params, request, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId) || itemId;

  const payload = await request.json();
  const { feedCrud } = data;
  const result = await feedCrud.update(itemUniqId, payload);

  if (result && result.errors) {
    return jsonResponse({ errors: result.errors }, 400);
  }

  return jsonResponse({ id: result }, 200);
}

export async function onRequestDelete({ params, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId) || itemId;

  const { feedCrud } = data;
  const result = await feedCrud.delete(itemUniqId);

  if (result && result.errors) {
    const status = isNotFoundError(result) ? 404 : 400;
    return jsonResponse({ errors: result.errors }, status);
  }

  return jsonResponse({ id: result }, 200);
}
