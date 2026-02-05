import FeedDb from "../../../../../edge-src/models/FeedDb";
import {deleteR2ObjectByUrl} from "../../../../../edge-src/EdgeCommonRequests";
import {ENCLOSURE_CATEGORIES} from "../../../../../common-src/Constants";
import {getIdFromSlug} from "../../../../../common-src/StringUtils";

export async function onRequestDelete({params, env, request}) {
  const {itemId} = params;
  const itemUniqId = getIdFromSlug(itemId);
  const urlObj = new URL(request.url);
  const hardParam = urlObj.searchParams.get('hard');
  const hardDelete = hardParam === 'true' || hardParam === '1';
  if (!hardDelete) {
    return new Response(JSON.stringify({error: 'Missing hard=true'}), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
      status: 400,
    });
  }

  const feedDb = new FeedDb(env, request);
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
    status: 200,
  });
}
