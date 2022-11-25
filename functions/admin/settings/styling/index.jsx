import React from "react";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeSettingsStylingApp";
import FeedDb from "../../../../edge-src/models/FeedDb";
import Theme from '../../../../edge-src/models/Theme';
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent();
  const {settings} = content;
  const {searchParams} = new URL(request.url);
  const themeName = searchParams.get('theme') || 'global';

  const theme = new Theme(await feed.getPublicJsonData(content), settings, themeName);
  const fromReact = renderReactToHtml(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
