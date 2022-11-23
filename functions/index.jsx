import React from "react";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import {WebResponseBuilder} from '../edge-src/common/PageUtils';
import {STATUSES} from "../common-src/Constants";

export async function onRequestGet({env, request}) {
  const webResponseBuilder = new WebResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
    limit: 20,
  });
  return webResponseBuilder.getResponse({
    getComponent: (content, jsonData, theme) => {
      return <EdgeHomeApp jsonData={jsonData} theme={theme}/>;
    },
  });
}
