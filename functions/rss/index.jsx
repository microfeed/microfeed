import {RssResponseBuilder} from "../../edge-src/common/PageUtils";
import FeedPublicRssBuilder from "../../edge-src/models/FeedPublicRssBuilder";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({request, env}) {
  const rssResponseBuilder = new RssResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await rssResponseBuilder.getResponse({
    buildXmlFunc: (jsonData) => {
      const urlObj = new URL(request.url);
      const builder = new FeedPublicRssBuilder(jsonData, urlObj.origin);
      return builder.getRssData();
    }
  });
}

export function onRequestHead() {
  return new Response('ok');
}
