import React from "react";
import FeedDb from "../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../edge-src/common/PageUtils";
import EdgeAdminHomeApp from "../../edge-src/EdgeAdminHomeApp";

export async function onRequestGet({ env, request }) {
  const feedDb = new FeedDb(env, request);
  const contentFromDb = await feedDb.getContent()

  const fromReact = renderReactToHtml(<EdgeAdminHomeApp feedContent={contentFromDb} />);

  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
