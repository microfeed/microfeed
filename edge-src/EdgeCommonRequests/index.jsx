import {JsonResponseBuilder} from "../common/PageUtils";
import {STATUSES} from "../../common-src/Constants";
import {getIdFromSlug} from "../../common-src/StringUtils";

export async function onFetchFeedJsonRequestGet({env, request}) {
  const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await jsonResponseBuilder.getResponse();
}

export async function onFetchItemRequestGet({params, env, request}) {
  const {slug, itemId} = params;
  const theItemId = itemId || getIdFromSlug(slug);

  if (theItemId) {
    const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
      queryKwargs: {
        id: theItemId,
        'status__in': [STATUSES.PUBLISHED, STATUSES.UNLISTED],
      },
      limit: 1,
    });
    return jsonResponseBuilder.getResponse({
      isValid: (jsonData) => {
        const item = jsonData.items && jsonData.items.length > 0 ? jsonData.items[0] : null;
        if (!item) {
          return false;
        }
        return true;
      }
    });
  }
  return JsonResponseBuilder.Response404();
}
