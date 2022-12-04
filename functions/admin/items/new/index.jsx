import React from "react";
import AdminItemsNewApp from '../../../../edge-src/EdgeAdminItemsApp/New';
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";

export async function onRequestGet({data}) {
  const {feedContent, onboardingResult} = data;
  const fromReact = renderReactToHtml(<AdminItemsNewApp
    feedContent={feedContent}
    onboardingResult={onboardingResult}
  />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
