// import React from "react";
// import ReactDOMServer from "react-dom/server";
// import EdgeHomeApp from '../edge-src/EdgeHomeApp';

export async function onRequestGet({request, env, params, waitUntil, next, data}) {
  const jsonObj = {
    'hello': 'world',
  };
  return new Response(JSON.stringify(jsonObj), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
