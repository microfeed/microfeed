const webpackStats = require("../../functions/webpack-stats.json");

export default class WebpackAssetsHandler {
  async element(element) {
    const scriptName = element.getAttribute('src');
    const realPath = webpackStats.assets[webpackStats.chunks[scriptName][0]].publicPath;
    element.setAttribute('src', realPath);
    switch (element.tagName) {
      case 'webpack-js':
        element.replace(`<script defer src="${realPath}"></script>`, {html: true});
        break;
      case 'webpack-css':
        element.replace(`<link rel="stylesheet" href="${realPath}">`, {html: true});
        break;
      default:
        break;
    }
  }
}
