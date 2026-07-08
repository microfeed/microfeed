import React from "react";
import EdgeAdminItemsApp from '../../../../edge-src/EdgeAdminItemsApp/Edit';
import FeedDb from "../../../../edge-src/models/FeedDb";
import {renderReactToHtml} from "../../../../edge-src/common/PageUtils";
import OnboardingChecker from "../../../../common-src/OnboardingUtils";
import {STATUSES} from "../../../../common-src/Constants";
import {serializeItemForFeed} from "../../../../edge-src/models/FeedItemSerializer";
import {RELATED_CONTENT} from "../../../../edge-src/models/RelationRepo";

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

  // The schema-driven editor (SchemaItemEditor) works with the item in its
  // PUBLIC field-key shape (same shape the FormRenderer/registry field defs
  // use, and the same shape POST/PUT /admin/ajax/items expect) rather than
  // the internal target-key shape `content.item` carries by default.
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';
  const row = content.item._feedRow;
  if (row) {
    content.item = serializeItemForFeed(row, {
      publicBucketUrl,
      tagIds: row.tagIds || [],
      members: row.members || [],
    });
    content.item.related_items = await feed.aggregationResolver.relationRepo.getMemberIds(
      row.id,
      RELATED_CONTENT,
    );
    if (content.item.content_type === 'gallery') {
      content.item.members = (row.members || []).map((m) => m.id);
    }
  }

  const onboardingChecker = new OnboardingChecker(content, request, env);
  const onboardingResult = onboardingChecker.getResult()
  const fromReact = renderReactToHtml(
    <EdgeAdminItemsApp
      feedContent={content}
      itemId={itemId}
      contentType={content.item.content_type}
      onboardingResult={onboardingResult}
    />);
  return new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
