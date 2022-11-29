import ReactDOMServer from "react-dom/server";
import Theme from "../models/Theme";
import FeedDb, {getFetchItemsParams} from "../models/FeedDb";
import {CODE_TYPES, STATUSES} from "../../common-src/Constants";

export function renderReactToHtml(Component) {
  return `<!DOCTYPE html>${ReactDOMServer.renderToString(Component)}`;
}

class ResponseBuilder {
  constructor(env, request) {
    this.feed = new FeedDb(env, request);
    this.request = request;
  }

  async fetchFeed() {
    this.content = await this.feed.getContent(this._fetchItems);
    this.settings = this.content.settings || {};
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

  static Response404(text = 'Not Found') {
    return new Response(text, {
      status: 404,
      statusText: text,
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

  get _fetchItems() {
    return getFetchItemsParams(this.request, {
      status: STATUSES.PUBLISHED,
    });
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
    const newResponse = new Response(JSON.stringify(this.jsonData), res);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  }
}

class CodeInjector {
  constructor(settings, theme, sharedTheme) {
    this.settings = settings;
    this.theme = theme;
    this.sharedTheme = sharedTheme;
  }
  element(element) {
    if (!this.settings) {
      return;
    }

    if (element.tagName === 'head') {
      if (this.settings.webGlobalSettings) {
        const {favicon, publicBucketUrl} = this.settings.webGlobalSettings;
        if (favicon && favicon.url) {
          const faviconUrl = favicon.url.startsWith('/') ? favicon.url : `${publicBucketUrl}/${favicon.url}`;
          element.append(`<link rel="icon" type="${favicon.contentType}" href="${faviconUrl}">`, {html: true});
        }
      }
      element.append(this.sharedTheme.getWebHeader().html || '', {html: true});
      const {html} = this.theme.getWebHeader();
      element.append(html, {html: true});
    } else if (element.tagName === 'body') {
      element.prepend(this.theme.getWebBodyStart().html, {html: true});
      element.prepend(this.sharedTheme.getWebBodyStart().html || '', {html: true});

      element.append(this.sharedTheme.getWebBodyEnd().html || '', {html: true});
      const {html} = this.theme.getWebBodyEnd();
      element.append(html, {html: true});
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
    const sharedTheme = new Theme(this.jsonData, this.settings, CODE_TYPES.SHARED);
    const fromReact = renderReactToHtml(
      props.getComponent(this.content, this.jsonData, theme));
    const newRes = new Response(fromReact, res);
    return new HTMLRewriter()
      .on('head', new CodeInjector(this.settings, theme, sharedTheme))
      .on('body', new CodeInjector(this.settings, theme, sharedTheme))
      .transform(newRes);
  }
}
