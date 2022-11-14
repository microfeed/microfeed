import React from "react";
import ReactDOMServer from 'react-dom/server';
import EdgeAdminChannelApp from '../../edge-src/EdgeAdminChannelApp';
import Feed from '../../edge-src/models/Feed';

export async function onRequestGet({ env }) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = ReactDOMServer.renderToString(<EdgeAdminChannelApp feedContent={content} />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
