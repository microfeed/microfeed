import React from "react";
import EdgeAdminItemsApp from '../../../edge-src/EdgeAdminItemsApp/Edit';
import ReactDOMServer from "react-dom/server";
import Feed from "../../../edge-src/models/Feed";

export async function onRequestGet({env, params}) {
  const { itemId } = params;
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = ReactDOMServer.renderToString(
    <EdgeAdminItemsApp feedContent={content} itemId={itemId}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
