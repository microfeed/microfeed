import React from "react";
import ReactDOMServer from "react-dom/server";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeSettingsStylingApp";
import Feed from "../../../../edge-src/models/Feed";
import Theme from '../../../../edge-src/models/Theme';

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const settings = await feed.getSettings(content);
  const theme = new Theme(content, settings);
  const fromReact = ReactDOMServer.renderToString(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
