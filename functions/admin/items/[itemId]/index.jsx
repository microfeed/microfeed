import React from "react";
import EdgeAdminItemsApp from '../../../../edge-src/EdgeAdminItemsApp/Edit';
import FeedDb from "../../../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";
import OnboardingChecker from "../../../../common-src/OnboardingUtils";
import {STATUSES} from "../../../../common-src/Constants";

export async function onRequestGet({env, params, request}) {
  const { itemId } = params;
  const feed = new FeedDb(env, request);
  const content = await feed.getContent({
    queryKwargs: {
      id: itemId,
    },
    limit: 1,
  });
  if (content.items && content.items.length > 0) {
    content.item = content.items[0];
  }
  if (!content.item || content.item.status === STATUSES.DELETED) {
    return new Response('Not found', {status:404});
  }
  const onboardingChecker = new OnboardingChecker(content, request, env);
  const onboardingResult = onboardingChecker.getResult()
  const fromReact = renderReactToHtml(
    <EdgeAdminItemsApp
      feedContent={content}
      itemId={itemId}
      onboardingResult={onboardingResult}
    />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
