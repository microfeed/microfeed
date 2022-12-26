import React from "react";
import {renderReactToHtml} from "../../edge-src/common/PageUtils";
import EdgeAdminHomeApp from "../../edge-src/EdgeAdminHomeApp";

export async function onRequestGet({ data }) {
  const {feedContent, onboardingResult} = data;

  const fromReact = renderReactToHtml(<EdgeAdminHomeApp
    feedContent={feedContent}
    onboardingResult={onboardingResult}
  />);

  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
