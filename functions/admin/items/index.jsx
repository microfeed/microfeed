import React from "react";
import EdgeAdminItemsApp from '../../../edge-src/EdgeAdminItemsApp';
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";
import FeedDb, {getFetchItemsParams} from "../../../edge-src/models/FeedDb";
import {STATUSES} from "../../../common-src/Constants";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent(getFetchItemsParams(request, {
    'status__!=': STATUSES.DELETED,
  }));
  const fromReact = renderReactToHtml(<EdgeAdminItemsApp feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
