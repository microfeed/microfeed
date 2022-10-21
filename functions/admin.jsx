// import React from "react";
import WebpackAssetsHandler from '../edge-src/common/WebpackAssetsHandler';

export async function onRequestGet({next}) {
  const response = await next();
  const newResponse = new Response(response.body, response);
  const rewriter = new HTMLRewriter()
    // .on('title', new MetaElementHandler(jsonData.name, null))
    // .on('meta[name=description]', new MetaElementHandler(jsonData.description, 'content'))
    // .on('div#edge-side-root', new ServerSideElementHandler(jsonData))
    .on('webpack-js', new WebpackAssetsHandler())
    .on('webpack-css', new WebpackAssetsHandler())
  return rewriter.transform(newResponse);
}
