import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {STATUSES} from "../../../../common-src/Constants";
import {onFetchItemRequestGet} from "../../../../edge-src/EdgeCommonRequests";

export async function onRequestGet({params, env, request}) {
  return await onFetchItemRequestGet({params, env, request});
}

// TODO: defensive code to handle some common errors
export async function onRequestDelete({ params, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);

  const { feedCrud } = data;
  feedCrud.upsertItem({
    id: itemUniqId,
    status: STATUSES.DELETED,
  });

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}

// TODO: defensive code to handle some common errors
export async function onRequestPut({ params, request, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);

  const itemJson = await request.json();
  const { feedCrud } = data;
  feedCrud.upsertItem({
    id: itemUniqId,
    ...itemJson,
  });

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
