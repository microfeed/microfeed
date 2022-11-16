import React from "react";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import {WebResponseBuilder} from '../edge-src/common/PageUtils';

export async function onRequestGet({env}) {
  const webResponseBuilder = new WebResponseBuilder(env);
  return webResponseBuilder.getResponse({
    getComponent: (content, jsonData, theme) => {
      return <EdgeHomeApp jsonData={jsonData} theme={theme}/>;
    },
  });
}
