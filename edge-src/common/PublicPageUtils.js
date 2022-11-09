import ReactDOMServer from "react-dom/server";
import Feed from "../../edge-src/models/Feed";
import Theme from "../models/Theme";

class CodeInjector {
  constructor(settings, theme) {
    this.settings = settings;
    this.theme = theme;
  }
  element(element) {
    if (!this.settings || !this.settings.codeInjection) {
      return;
    }

    if (element.tagName === 'head') {
      element.append(this.theme.getWebHeader(), {html: true});
      element.append(this.settings.codeInjection.headerCode || '', {html: true});
    } else if (element.tagName === 'body') {
      element.append(this.theme.getWebFooter(), {html: true});
      element.append(this.settings.codeInjection.footerCode || '', {html: true});
    }
  }
}

export async function getResponseForPage(getComponent, env) {
  const feed = new Feed(env);
  const content = await feed.getContent();
  const settings = await feed.getSettings(content);
  const theme = new Theme(await feed.getContentPublic(content), null);
  const fromReact = ReactDOMServer.renderToString(await getComponent(feed, content, theme));
  const res = new Response(fromReact, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
  return new HTMLRewriter()
    .on('head', new CodeInjector(settings, theme))
    .on('body', new CodeInjector(settings, theme))
    .transform(res);
}
