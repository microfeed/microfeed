import React from "react";
import AdminItemsNewApp from '../../../../edge-src/EdgeAdminItemsApp/New';
import FeedDb from "../../../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent();
  const fromReact = renderReactToHtml(<AdminItemsNewApp feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
