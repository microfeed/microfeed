import ReactDOMServer from "react-dom/server";
import Feed from "../../edge-src/models/Feed";
import Theme from "../models/Theme";

export function renderReactToHtml(Component) {
  return `<!DOCTYPE html>${ReactDOMServer.renderToString(Component)}`;
}

class ResponseBuilder {
  constructor(env, request) {
    this.feed = new Feed(env, request);
  }

  async fetchFeed() {
    this.content = await this.feed.getContent();
    this.settings = await this.feed.getSettings(this.content) || {};
    this.jsonData = await this.feed.getPublicJsonData(this.content);
  }

  _verifyPasscode() {
    // TODO: check passcord in query string / cookie
    return true;
  }

  async getResponse(props) {
    await this.fetchFeed();
    if (this.settings.access) {
      const {currentPolicy} = this.settings.access;
      switch (currentPolicy) {
        case 'passcode':
          if (!this._verifyPasscode()) {
            // TODO: redirect to a page (401) to type in passcode
          }
          break;
        case 'offline':
          return ResponseBuilder.Response404();
        default:
          break;
      }
    }
    return this._getResponse(props);
  }

  static Response404() {
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    });
  }

  static notEnabledResponse(subscribeMethods, type) {
    let notFoundRes = null;
    if (subscribeMethods && subscribeMethods.methods && subscribeMethods.methods.length > 0) {
      subscribeMethods.methods.forEach((method) => {
        if (method.type === type && !method.editable && !method.enabled) {
          notFoundRes = ResponseBuilder.Response404();
        }
      });
    }
    return notFoundRes;
  }

  //
  // Override these two methods
  //
  get _contentType() {
    return 'text/html; charset=utf-8';
  }

  /**
   * Typically, code will look like this:
   *
   *   const res = super._getResponse(props);
   *   res.headers.set('header-name', 'header-value');
   *   return new Response(props.buildXmlFunc(this.jsonData), res);
   *
   * @returns {Response}
   * @private
   */
  _getResponse(/* props */) {
    return new Response('ok', {
      headers: {
        'content-type': this._contentType,
      },
    });
  }
}

export class RssResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'application/xml';
  }
  _getResponse(props) {
    const res = super._getResponse(props);
    const {subscribeMethods} = this.settings;
    let notFoundRes = ResponseBuilder.notEnabledResponse(subscribeMethods, 'rss');
    if (notFoundRes) {
      return notFoundRes;
    }
    return new Response(props.buildXmlFunc(this.jsonData), res);
  }
}

export class JsonResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'application/json;charset=UTF-8';
  }

  _getResponse(props) {
    const res = super._getResponse(props);
    const {subscribeMethods} = this.settings;
    let notFoundRes = ResponseBuilder.notEnabledResponse(subscribeMethods, 'json');
    if (notFoundRes) {
      return notFoundRes;
    }
    return new Response(JSON.stringify(this.jsonData), res);
  }
}

class CodeInjector {
  constructor(settings, theme) {
    this.settings = settings;
    this.theme = theme;
  }
  element(element) {
    if (!this.settings) {
      return;
    }

    if (element.tagName === 'head') {
      const {html} = this.theme.getWebHeader();
      element.append(html, {html: true});
      if (this.settings.webGlobalSettings) {
        const {headerCode, favicon, publicBucketUrl} = this.settings.webGlobalSettings;
        element.append(headerCode || '', {html: true});
        const faviconUrl = favicon.url.startsWith('/') ? favicon.url : `${publicBucketUrl}/${favicon.url}`;
        element.append(`<link rel="icon" type="${favicon.contentType}" href="${faviconUrl}">`, {html: true});
      }
    } else if (element.tagName === 'body') {
      const {html} = this.theme.getWebFooter();
      element.append(html, {html: true});
      if (this.settings.webGlobalSettings) {
        element.append(this.settings.webGlobalSettings.footerCode || '', {html: true});
      }
    }
  }
}

export class WebResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'text/html; charset=utf-8';
  }

  _getResponse(props) {
    const res = super._getResponse(props);
    const theme = new Theme(this.jsonData, this.settings);
    const fromReact = renderReactToHtml(
      props.getComponent(this.content, this.jsonData, theme));
    const newRes = new Response(fromReact, res);
    return new HTMLRewriter()
      .on('head', new CodeInjector(this.settings, theme))
      .on('body', new CodeInjector(this.settings, theme))
      .transform(newRes);
  }
}
