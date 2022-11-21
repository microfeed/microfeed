import React from "react";
import EdgeAdminItemsApp from '../../../edge-src/EdgeAdminItemsApp';
import Feed from "../../../edge-src/models/Feed";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const feed = new Feed(env, request);
  const content = await feed.getContent();
  const fromReact = renderReactToHtml(<EdgeAdminItemsApp feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
