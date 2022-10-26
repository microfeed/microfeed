import React from "react";
import AdminPodcastApp from '../../edge-src/EdgeAdminPodcastApp';
import ReactDOMServer from "react-dom/server";

export async function onRequestGet() {
  const fromReact = ReactDOMServer.renderToString(<AdminPodcastApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
