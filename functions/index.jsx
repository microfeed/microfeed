import React from "react";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import {WebResponseBuilder} from '../edge-src/common/PageUtils';

export async function onRequestGet({env, request}) {
  const webResponseBuilder = new WebResponseBuilder(env, request);
  // const {FEED_DB} = env;
  // const queryRes = await FEED_DB.prepare("SELECT * FROM items").all();
  // console.log('query duration', queryRes.duration);
  // console.log('records total', queryRes.results.length);
  // console.log('records[1]', queryRes.results[1]);
  return webResponseBuilder.getResponse({
    getComponent: (content, jsonData, theme) => {
      return <EdgeHomeApp jsonData={jsonData} theme={theme}/>;
    },
  });
}
