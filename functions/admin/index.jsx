import React from "react";
import EdgeAdminChannelApp from '../../edge-src/EdgeAdminChannelApp';
import FeedDb from "../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../edge-src/common/PageUtils";

export async function onRequestGet({ env, request }) {
  const feedDb = new FeedDb(env, request);
  const contentFromDb = await feedDb.getContent()

  const fromReact = renderReactToHtml(<EdgeAdminChannelApp feedContent={contentFromDb} />);

  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
