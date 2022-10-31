import React from "react";
import AdminEpisodesEditApp from '../../../edge-src/EdgeAdminEpisodesApp/Edit';
import ReactDOMServer from "react-dom/server";
import Feed from "../../../edge-src/models/Feed";

export async function onRequestGet({env, params}) {
  const { episodeId } = params;
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = ReactDOMServer.renderToString(
    <AdminEpisodesEditApp feedContent={content} episodeId={episodeId}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
