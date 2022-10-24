import React from "react";
import AdminHomeApp from '../../edge-src/AdminHomeApp';
import ReactDOMServer from "react-dom/server";

export async function onRequestGet() {
  const fromReact = ReactDOMServer.renderToString(<AdminHomeApp />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
