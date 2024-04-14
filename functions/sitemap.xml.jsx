import {SitemapResponseBuilder} from '../edge-src/common/PageUtils';
import {STATUSES} from "../common-src/Constants";

export async function onRequestGet({env, request}) {
  const sitemapResponseBuilder = new SitemapResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return sitemapResponseBuilder.getResponse({
    getComponent: (_, jsonData) => {
      return jsonData
    },
  });
}
