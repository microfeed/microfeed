import React from "react";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import {getResponseForPage} from '../edge-src/common/PublicPageUtils';

export async function onRequestGet({env}) {
  return await getResponseForPage((jsonData) => <EdgeHomeApp jsonData={jsonData}/>, env);
}
