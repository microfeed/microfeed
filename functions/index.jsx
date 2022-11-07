import React from "react";
import ReactDOMServer from "react-dom/server";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import Feed from "../edge-src/models/Feed";

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const jsonData = await feed.getContentPublic();
  const settings = await feed.getSettings();
  const fromReact = ReactDOMServer.renderToString(<EdgeHomeApp jsonData={jsonData} settings={settings} />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
