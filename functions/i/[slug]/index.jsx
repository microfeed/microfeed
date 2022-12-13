import React from "react";
import EdgeItemApp from "../../../edge-src/EdgeItemApp";
import {WebResponseBuilder} from '../../../edge-src/common/PageUtils';
import {PUBLIC_URLS, getIdFromSlug} from "../../../common-src/StringUtils";
import {STATUSES} from "../../../common-src/Constants";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;
  const itemId = getIdFromSlug(slug);

  if (itemId) {
    const webResponseBuilder = new WebResponseBuilder(env, request, {
      queryKwargs: {
        id: itemId,
        'status__in': [STATUSES.PUBLISHED, STATUSES.UNLISTED],
      },
      limit: 1,
    });
    return webResponseBuilder.getResponse({
      getComponent: (content, jsonData, theme) => {
        const item = jsonData.items && jsonData.items.length > 0 ? jsonData.items[0] : null;
        if (!item) {
          return null;
        }
        const urlObject = new URL(request.url);
        const canonicalUrl = PUBLIC_URLS.webItem(itemId, item.title, urlObject.origin);
        return <EdgeItemApp item={item} theme={theme} jsonData={jsonData} canonicalUrl={canonicalUrl}/>;
      },
    });
  }
  return WebResponseBuilder.Response404();
}
