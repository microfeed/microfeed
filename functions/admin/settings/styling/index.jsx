import React from "react";
import ReactDOMServer from "react-dom/server";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeSettingsStylingApp";
import Feed from "../../../../edge-src/models/Feed";
import Theme from '../../../../edge-src/models/Theme';

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  let currentTheme = null;
  if (content.settings && content.settings.styling) {
    currentTheme = content.settings.styling.currentTheme;
    /*
      // in feed.json:
      styling: {
        currentTheme: 'unique-theme-name1',
      }

      // in r2's themes/unique-theme-name1/ folder (or in KV / D1 or any db
      // - feedWeb.html
      // - episodeWeb.html
      // -
      // - rssStylesheet.xsl
     */
  }
  const theme = new Theme(content, currentTheme);
  const fromReact = ReactDOMServer.renderToString(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
