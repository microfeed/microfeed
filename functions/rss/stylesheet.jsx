import Feed from "../../edge-src/models/Feed";
import Theme from "../../edge-src/models/Theme";


export async function onRequestGet({request, env}) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const settings = await feed.getSettings(content);
  const theme = new Theme(await feed.getContentPublic(content), settings);
  const {stylesheet} = theme.getRssStylesheet();
  return new Response(stylesheet, {
      headers: {
        'content-type': 'text/xsl',
      },
  });
}
