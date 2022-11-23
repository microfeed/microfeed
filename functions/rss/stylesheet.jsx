import Feed from "../../edge-src/models/FeedDb";
import Theme from "../../edge-src/models/Theme";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({request, env}) {
  const feed = new Feed(env, request);
  const content = await feed.getContent({
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
    limit: 1,
  });
  const {settings} = content;
  const theme = new Theme(await feed.getPublicJsonData(content), settings);
  const {stylesheet} = theme.getRssStylesheet();
  return new Response(stylesheet, {
      headers: {
        'content-type': 'text/xsl',
      },
  });
}
