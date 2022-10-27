import React from "react";
import ReactDOMServer from 'react-dom/server';
import AdminPodcastApp from '../../edge-src/EdgeAdminPodcastApp';
import Feed from '../../edge-src/models/Feed';

export async function onRequestGet({ env }) {
  const feed = new Feed(env);
  let content = await feed.getContent();
  console.log(content);
  await feed.destroy();
  content = await feed.getContent();
  console.log(content);
  const fromReact = ReactDOMServer.renderToString(<AdminPodcastApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
