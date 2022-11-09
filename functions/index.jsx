import React from "react";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import {getResponseForPage} from '../edge-src/common/PublicPageUtils';

export async function onRequestGet({env}) {
  return await getResponseForPage(async (feed, content, theme) => {
    const jsonData = await feed.getContentPublic(content);
    return <EdgeHomeApp jsonData={jsonData} theme={theme}/>;
  }, env);
}
