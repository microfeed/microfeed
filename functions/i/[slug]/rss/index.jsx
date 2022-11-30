import {RssResponseBuilder} from "../../../../edge-src/common/PageUtils";
import FeedPublicRssBuilder from "../../../../edge-src/models/FeedPublicRssBuilder";
import {getIdFromSlug} from "../../../../common-src/StringUtils";
import {STATUSES} from "../../../../common-src/Constants";

export async function onRequestGet({request, env, params}) {
  const {slug} = params;
  const itemId = getIdFromSlug(slug);
  if (itemId) {
    const rssResponseBuilder = new RssResponseBuilder(env, request, {
      queryKwargs: {
        id: itemId,
        status: STATUSES.PUBLISHED,
      },
      limit: 1,
    });
    return await rssResponseBuilder.getResponse({
      buildXmlFunc: (jsonData) => {
        const item = jsonData.items && jsonData.items.length > 0 ? jsonData.items[0] : null;
        if (!item) {
          return null;
        }
        const urlObj = new URL(request.url);
        const builder = new FeedPublicRssBuilder(jsonData, urlObj.origin);
        return builder.getRssData();
      }
    });
  }
  return RssResponseBuilder.Response404();
}
