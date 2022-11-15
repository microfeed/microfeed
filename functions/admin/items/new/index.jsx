import React from "react";
import AdminItemsNewApp from '../../../../edge-src/EdgeAdminItemsApp/New';
import ReactDOMServer from "react-dom/server";
import Feed from "../../../../edge-src/models/Feed";

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = ReactDOMServer.renderToString(<AdminItemsNewAppq feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
