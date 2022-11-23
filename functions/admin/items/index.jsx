import React from "react";
import EdgeAdminItemsApp from '../../../edge-src/EdgeAdminItemsApp';
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";
import FeedDb from "../../../edge-src/models/FeedDb";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent({
    queryKwargs: {},
    limit: 20,
  });
  const fromReact = renderReactToHtml(<EdgeAdminItemsApp feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
