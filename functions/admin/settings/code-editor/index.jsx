import React from "react";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeCustomCodeEditorApp";
import FeedDb, {getFetchItemsParams} from "../../../../edge-src/models/FeedDb";
import Theme from '../../../../edge-src/models/Theme';
import {renderReactToHtml, WebResponseBuilder} from "../../../../edge-src/common/PageUtils";
import {STATUSES, CODE_TYPES} from "../../../../common-src/Constants";

export async function onRequestGet({env, request}) {
  const feed = new FeedDb(env, request);
  const content = await feed.getContent(getFetchItemsParams(request, {
    'status__!=': STATUSES.DELETED,
  }, 1));
  const {settings} = content;
  const {searchParams} = new URL(request.url);
  const themeName = searchParams.get('theme') || CODE_TYPES.SHARED;

  // TODO: Remove this after we support multiple themes
  if (![CODE_TYPES.SHARED, 'custom'].includes(themeName)) {
    return WebResponseBuilder.Response404();
  }

  const theme = new Theme(await feed.getPublicJsonData(content), settings, themeName);
  const fromReact = renderReactToHtml(
    <EdgeSettingsStylingApp feedContent={content} theme={theme}/>);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
