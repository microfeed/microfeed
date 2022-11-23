import React from "react";
import AdminSettingsApp from "../../../edge-src/EdgeSettingsApp";
import FeedDb from "../../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";


export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent();
  const fromReact = renderReactToHtml(<AdminSettingsApp feedContent={content}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
