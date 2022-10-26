import React from "react";
import AdminEpisodesApp from '../../../edge-src/EdgeAdminEpisodesApp';
import ReactDOMServer from "react-dom/server";

export async function onRequestGet() {
  const fromReact = ReactDOMServer.renderToString(<AdminEpisodesApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
