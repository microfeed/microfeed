import React from "react";
import AdminEpisodesNewApp from '../../../../edge-src/EdgeAdminEpisodesApp/New';
import ReactDOMServer from "react-dom/server";

export async function onRequestGet() {
  const fromReact = ReactDOMServer.renderToString(<AdminEpisodesNewApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
