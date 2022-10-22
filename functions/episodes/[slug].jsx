// import React from "react";
// import WebpackAssetsHandler from '../../edge-src/common/WebpackAssetsHandler';

export async function onRequestGet({params}) {
  const {slug} = params;
  console.log(slug);
  return new Response('ok');
}
