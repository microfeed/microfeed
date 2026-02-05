import {RssResponseBuilder} from "../../edge-src/common/PageUtils";
import FeedPublicRssBuilder from "../../edge-src/models/FeedPublicRssBuilder";
import {STATUSES} from "../../common-src/Constants";
import FeedDb from "../../edge-src/models/FeedDb";

export async function onRequestGet({request, env}) {
  const urlObj = new URL(request.url);
  const typeParam = urlObj.searchParams.get('type');
  const queryKwargs = {
    status: STATUSES.PUBLISHED,
  };
  if (typeParam) {
    let typeSlug = typeParam;
    if (typeParam === 'audio') {
      typeSlug = 'podcast';
    } else if (typeParam === 'video') {
      typeSlug = 'video';
    }
    const feedDb = new FeedDb(env, request);
    const type = await feedDb.getItemTypeBySlug(typeSlug);
    if (!type) {
      return new Response('Not Found', {status: 404});
    }
    queryKwargs.type_id = type.id;
  }
  const rssResponseBuilder = new RssResponseBuilder(env, request, {
    queryKwargs,
  });
  return await rssResponseBuilder.getResponse({
    buildXmlFunc: (jsonData) => {
      const urlObj = new URL(request.url);
      urlObj.searchParams.delete('next_cursor');
      urlObj.searchParams.delete('prev_cursor');
      urlObj.searchParams.delete('sort');
      const feedUrl = `${urlObj.origin}${urlObj.pathname}${urlObj.search}`;
      const builder = new FeedPublicRssBuilder(jsonData, urlObj.origin, feedUrl);
      return builder.getRssData();
    }
  });
}

export function onRequestHead() {
  return new Response('ok');
}
