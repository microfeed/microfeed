import {JsonResponseBuilder} from '../../../../edge-src/common/PageUtils';
import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {STATUSES} from "../../../../common-src/Constants";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;
  const itemId = getIdFromSlug(slug);

  if (itemId) {
    const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
      queryKwargs: {
        id: itemId,
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

export function onRequestHead() {
  return new Response('ok');
}
