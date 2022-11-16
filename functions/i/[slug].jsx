import React from "react";
import EdgeItemApp from "../../edge-src/EdgeItemApp";
import {WebResponseBuilder} from '../../edge-src/common/PageUtils';

export async function onRequestGet({params, env}) {
  const {slug} = params;
  const re = /^.+-([\d\w\-_]{11})$/;
  const ok = re.exec(slug);
  if (ok) {
    const itemId = ok[1];
    if (itemId) {
      const webResponseBuilder = new WebResponseBuilder(env);
      return webResponseBuilder.getResponse({
        getComponent: (content, jsonData, theme) => {
          const item = content.items[itemId];
          return <EdgeItemApp item={item} theme={theme}/>;
        },
      });
    }
  }
  return WebResponseBuilder.Response404();
}
