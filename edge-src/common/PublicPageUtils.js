import ReactDOMServer from "react-dom/server";
import Feed from "../../edge-src/models/Feed";

class CodeInjector {
  constructor(settings) {
    this.settings = settings;
  }
  element(element) {
    if (!this.settings || !this.settings.codeInjection) {
      return;
    }

    if (element.tagName === 'head' && this.settings.codeInjection.headerCode) {
      element.append(this.settings.codeInjection.headerCode || '', {html: true});
    } else if (element.tagName === 'body' && this.settings.codeInjection.footerCode) {
      element.append(this.settings.codeInjection.footerCode || '', {html: true});
    }
  }
}

export async function getResponseForPage(getComponent, env) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const jsonData = await feed.getContentPublic(content);
  const settings = await feed.getSettings(content);
  const fromReact = ReactDOMServer.renderToString(getComponent(jsonData, settings));
  const res = new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
  return new HTMLRewriter()
    .on('head', new CodeInjector(settings))
    .on('body', new CodeInjector(settings))
    .transform(res);
}
