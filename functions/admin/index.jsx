import React from "react";
import ReactDOMServer from 'react-dom/server';
import AdminPodcastApp from '../../edge-src/EdgeAdminPodcastApp';
import Podcast from '../../edge-src/models/Podcast';

export async function onRequestGet({ env }) {
  const pod = new Podcast(env);
  const podMeta = await pod.getValue();
  const fromReact = ReactDOMServer.renderToString(<AdminPodcastApp podMeta={podMeta} />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
