import React from "react";
import EdgeSettingsStylingApp from "../../../../edge-src/EdgeCustomCodeEditorApp";
import Theme from '../../../../edge-src/models/Theme';
import {renderReactToHtml, WebResponseBuilder} from "../../../../edge-src/common/PageUtils";
import {CODE_TYPES} from "../../../../common-src/Constants";

export async function onRequestGet({request, data}) {
  const {feedDb, feedContent, onboardingResult} = data;

  const {settings} = feedContent;
  const {searchParams} = new URL(request.url);
  const themeName = searchParams.get('theme') || CODE_TYPES.SHARED;

  // TODO: Remove this after we support multiple themes
  if (![CODE_TYPES.SHARED, 'custom'].includes(themeName)) {
    return WebResponseBuilder.Response404();
  }

  const theme = new Theme(await feedDb.getPublicJsonData(feedContent), settings, themeName);
  const fromReact = renderReactToHtml(
    <EdgeSettingsStylingApp
      feedContent={feedContent}
      theme={theme}
      onboardingResult={onboardingResult}
    />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
