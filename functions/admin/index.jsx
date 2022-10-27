import React from "react";
import ReactDOMServer from 'react-dom/server';
import AdminPodcastApp from '../../edge-src/EdgeAdminPodcastApp';
import Feed from '../../edge-src/models/Feed';

export async function onRequestGet({ env }) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = ReactDOMServer.renderToString(<AdminPodcastApp feedContent={content} />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
