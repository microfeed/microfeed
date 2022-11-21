import React from "react";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeSettingsStylingApp";
import Feed from "../../../../edge-src/models/Feed";
import Theme from '../../../../edge-src/models/Theme';
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const feed = new Feed(env, request);
  const content = await feed.getContent();
  const settings = await feed.getSettings(content);
  const theme = new Theme(await feed.getPublicJsonData(content), settings);
  const fromReact = renderReactToHtml(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
