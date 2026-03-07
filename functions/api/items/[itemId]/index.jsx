import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {ENCLOSURE_CATEGORIES, ITEM_STATUSES_STRINGS_DICT, STATUSES} from "../../../../common-src/Constants";
import {onFetchItemRequestGet} from "../../../../edge-src/EdgeCommonRequests";
import {deleteR2ObjectByUrl} from "../../../../edge-src/EdgeCommonRequests";

export async function onRequestGet({params, env, request}) {
  return await onFetchItemRequestGet(
    {params, env, request}, false, [
      STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED]);
}

// TODO: defensive code to handle some common errors
export async function onRequestDelete({ params, data, request, env }) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);
  const urlObj = new URL(request.url);
  const hardParam = urlObj.searchParams.get('hard');
  const hardDelete = hardParam === 'true' || hardParam === '1';

  if (hardDelete) {
    const {feedDb} = data;
    const content = await feedDb.getContent({
      queryKwargs: {
        id: itemUniqId,
      },
      limit: 1,
    });
    const item = content.items && content.items.length > 0 ? content.items[0] : null;
    if (!item) {
      return new Response(JSON.stringify({error: 'Not found'}), {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        status: 404,
      });
    }

    const urlsToDelete = new Set();
    if (item.image) {
      urlsToDelete.add(item.image);
    }
    if (item.ogImage) {
      urlsToDelete.add(item.ogImage);
    }
    if (item.mediaFile && item.mediaFile.url && item.mediaFile.category !== ENCLOSURE_CATEGORIES.EXTERNAL_URL) {
      urlsToDelete.add(item.mediaFile.url);
    }
    for (const mediaUrl of urlsToDelete) {
      try {
        await deleteR2ObjectByUrl(env, mediaUrl);
      } catch (e) { // eslint-disable-line
      }
    }
    await feedDb.deleteItemById(itemUniqId);
    return new Response(JSON.stringify({}), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    });
  }

  const { feedCrud } = data;
  await feedCrud.upsertItem({
    id: itemUniqId,
    date_published_ms: new Date().getTime(),
    status: STATUSES.ARCHIVED,
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
