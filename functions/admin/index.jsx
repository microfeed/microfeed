import React from "react";
import ReactDOMServer from 'react-dom/server';
import AdminPodcastApp from '../../edge-src/EdgeAdminPodcastApp';
import Podcast from '../../edge-src/models/Podcast';

export async function onRequestGet({ env }) {
  const pod = new Podcast(env);
  let podMeta = await pod.getValue();
  podMeta = await pod.setValue({'title': 'he'});
  podMeta = await pod.updateValue({'description': 'aaa'});
  const fromReact = ReactDOMServer.renderToString(<AdminPodcastApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
