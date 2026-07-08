import React from "react";
import AdminTagsApp from "../../../edge-src/EdgeTagsApp";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";


export async function onRequestGet({data}) {
  const {feedContent, onboardingResult} = data;
  const fromReact = renderReactToHtml(<AdminTagsApp
    feedContent={feedContent}
    onboardingResult={onboardingResult}
  />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
