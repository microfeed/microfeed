import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {ITEM_STATUSES_STRINGS_DICT, STATUSES} from "../../../../common-src/Constants";
import {onFetchItemRequestGet} from "../../../../edge-src/EdgeCommonRequests";

export async function onRequestGet({params, env, request}) {
  return await onFetchItemRequestGet(
    {params, env, request}, false, [
      STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED]);
}

// TODO: defensive code to handle some common errors
export async function onRequestDelete({ params, data }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);

  const { feedCrud } = data;
  await feedCrud.upsertItem({
    id: itemUniqId,
    date_published_ms: new Date().getTime(),
    status: STATUSES.DELETED,
  });

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}

// TODO: defensive code to handle some common errors
export async function onRequestPut({ params, request, data, env }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);

  const res = await onRequestGet({params, request, env});
  let oldItem = {}
  if (res.status === 200) {
    const feed = await res.json();
    if (feed.items && feed.items.length > 0) {
      oldItem = feed.items[0];
    }
  } else {
    return res;
  }

  const itemJson = await request.json();
  const newItemJson = {
    ...oldItem,
    ...itemJson,
  }
  if (!itemJson.date_published_ms) {
    newItemJson.date_published_ms = newItemJson.date_published ?
      new Date(newItemJson.date_published).getTime() : new Date().getTime();
  }

  newItemJson.status = ITEM_STATUSES_STRINGS_DICT[itemJson.status] ||
    ITEM_STATUSES_STRINGS_DICT[oldItem._microfeed.status] || STATUSES.PUBLISHED;

  const { feedCrud } = data;
  await feedCrud.upsertItem({
    id: itemUniqId,
    ...newItemJson,
  });

  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
