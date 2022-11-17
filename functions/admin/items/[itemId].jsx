import React from "react";
import EdgeAdminItemsApp from '../../../edge-src/EdgeAdminItemsApp/Edit';
import Feed from "../../../edge-src/models/Feed";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";

export async function onRequestGet({env, params}) {
  const { itemId } = params;
  const feed = new Feed(env);
  const content = await feed.getContent();
  const fromReact = renderReactToHtml(
    <EdgeAdminItemsApp feedContent={content} itemId={itemId}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
