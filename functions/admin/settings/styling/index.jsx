import React from "react";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeSettingsStylingApp";
import Feed from "../../../../edge-src/models/Feed";
import Theme from '../../../../edge-src/models/Theme';
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({env}) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const settings = await feed.getSettings(content);
  const theme = new Theme(content, settings);
  const fromReact = renderReactToHtml(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
