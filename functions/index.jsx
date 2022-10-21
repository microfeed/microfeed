import React from "react";
import ReactDOMServer from "react-dom/server";
import EdgeHomeApp from '../edge-src/EdgeHomeApp';
import PodcastData from "../edge-src/common/PodcastData"
import WebpackAssetsHandler from '../edge-src/common/WebpackAssetsHandler';

class ServerSideElementHandler {
  constructor(jsonData) {
    this.jsonData = jsonData;
  }
  async element(element) {
    const fromReact = ReactDOMServer.renderToString(<EdgeHomeApp jsonData={this.jsonData} />);
    element.replace(fromReact, { html: true });
  }
}

class MetaElementHandler {
  constructor(targetText, attributeName) {
    this.targetText = targetText;
    this.attributeName = attributeName;
  }
  async element(element) {
    if (this.attributeName) {
      element.setAttribute(this.attributeName, this.targetText);
    } else {
      element.setInnerContent(this.targetText);
    }
  }
}

export async function onRequestGet({next}) {
  const podcastData = new PodcastData();
  const jsonData = await podcastData.getData();

  const response = await next();
  const newResponse = new Response(response.body, response);
  const rewriter = new HTMLRewriter()
    .on('title', new MetaElementHandler(jsonData.name, null))
    .on('meta[name=description]', new MetaElementHandler(jsonData.description, 'content'))
    .on('div#edge-side-root', new ServerSideElementHandler(jsonData))
    .on('webpack-js', new WebpackAssetsHandler())
    .on('webpack-css', new WebpackAssetsHandler())
  return rewriter.transform(newResponse);
}
