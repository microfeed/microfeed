import React from "react";
import ReactDOMServer from "react-dom/server";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import PodcastData from "../edge-src/common/PodcastData"

export async function onRequestGet() {
  const podcastData = new PodcastData();
  const jsonData = await podcastData.getData();
  const fromReact = ReactDOMServer.renderToString(<EdgeHomeApp jsonData={jsonData} />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
