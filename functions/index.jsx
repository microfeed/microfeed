import React from "react";
import ReactDOMServer from "react-dom/server";

class HelloMessage extends React.Component {
  render() {
    return <div>Hello, {this.props.name} from React server-side rendering</div>;
  }
}

class ServerSideElementHandler {
  async element(element) {
    const fromReact = ReactDOMServer.renderToString(<HelloMessage name="World" />);
    element.replace(
      '<div class="text-xl font-bold">Rendered from Functions (server-side)</div>' + fromReact,
      { html: true });
  }
}

class WebpackAssetsHandler {
  async element(element) {
    const scriptName = element.getAttribute('src');
    const webpackStats = require('./webpack-stats.json');
    const realPath = webpackStats.assets[webpackStats.chunks[scriptName][0]].publicPath;
    element.setAttribute('src', realPath);
    element.replace(`<script defer src="${realPath}"></script>`, { html: true });
  }
}

export async function onRequestGet({request, env, params, waitUntil, next, data}) {
  //   request, // same as existing Worker API
  //   env, // same as existing Worker API
  //   params, // if filename includes [id] or [[path]]
  //   waitUntil, // same as ctx.waitUntil in existing Worker API
  //   next, // used for middleware or to fetch assets
  //   data, // arbitrary space for passing data between middlewares

  const response = await next();
  const newResponse = new Response(response.body, response);
  const rewriter = new HTMLRewriter()
    .on('div#edge-side-root', new ServerSideElementHandler())
    .on('webpack-js', new WebpackAssetsHandler())
    .on('webpack-css', new WebpackAssetsHandler())
  return rewriter.transform(newResponse);
}
