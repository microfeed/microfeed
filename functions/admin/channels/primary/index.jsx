import React from "react";
import EdgeAdminChannelApp from '../../../../edge-src/EdgeAdminChannelApp';
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({ data }) {
  const {feedContent, onboardingResult} = data;
  const fromReact = renderReactToHtml(<EdgeAdminChannelApp
    feedContent={feedContent}
    onboardingResult={onboardingResult}
  />);

  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
