import React from "react";
import EdgeItemApp from "../../edge-src/EdgeItemApp";
import {WebResponseBuilder} from '../../edge-src/common/PageUtils';
import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;
  const re = /^.+-([\d\w\-_]{11})$/;
  const ok = re.exec(slug);
  if (ok) {
    const itemId = ok[1];
    if (itemId) {
      const webResponseBuilder = new WebResponseBuilder(env, request, {
        queryKwargs: {
          id: itemId,
          status: STATUSES.PUBLISHED,
        },
        limit: 1,
      });
      return webResponseBuilder.getResponse({
        getComponent: (content, jsonData, theme) => {
          const item = jsonData.items && jsonData.items.length > 0 ? jsonData.items[0] : null;
          const urlObject = new URL(request.url);
          const canonicalUrl = PUBLIC_URLS.webItem(itemId, item.title, urlObject.origin);
          return <EdgeItemApp item={item} theme={theme} jsonData={jsonData} canonicalUrl={canonicalUrl}/>;
        },
      });
    }
  }
  return WebResponseBuilder.Response404();
}
