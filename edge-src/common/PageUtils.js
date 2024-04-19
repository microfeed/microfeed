import ReactDOMServer from "react-dom/server";
import Theme from "../models/Theme";
import FeedDb, {getFetchItemsParams} from "../models/FeedDb";
import {CODE_TYPES, STATUSES} from "../../common-src/Constants";
import {ADMIN_URLS, escapeHtml, urlJoinWithRelative} from "../../common-src/StringUtils";
import OnboardingChecker from "../../common-src/OnboardingUtils";

export function renderReactToHtml(Component) {
  return `<!DOCTYPE html>${ReactDOMServer.renderToString(Component)}`;
}

class ResponseBuilder {
  constructor(env, request, fetchItemsObj = null) {
    this.feed = new FeedDb(env, request);
    this.request = request;
    this.fetchItemsObj = fetchItemsObj || {};
    this.env = env;
  }

  async fetchFeed() {
    this.content = await this.feed.getContent(this._fetchItems);
    this.settings = this.content.settings || {};
    const queryKwargs = this.fetchItemsObj.queryKwargs || {};
    const forOneItem = !!queryKwargs.id;
    this.jsonData = await this.feed.getPublicJsonData(this.content, forOneItem);
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

    const onboardingChecker = new OnboardingChecker(this.content, this.request, this.env);
    const onboardingResult = onboardingChecker.getResult()
    if (!onboardingResult.requiredOk) {
      const urlObj = new URL(this.request.url);
      return Response.redirect(ADMIN_URLS.home(urlObj.origin), 302);
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
    const queryKwargs  = this.fetchItemsObj.queryKwargs || {};
    return getFetchItemsParams(
      this.request,
      {
        // status: STATUSES.PUBLISHED,
        ...queryKwargs,
      }, this.fetchItemsObj.limit);
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
    const rssRes = props.buildXmlFunc(this.jsonData);
    if (!rssRes) {
      return ResponseBuilder.Response404();
    }
    return new Response(rssRes, res);
  }
}

export class JsonResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'application/json;charset=UTF-8';
  }

  _getResponse(props) {
    const res = super._getResponse(props);

    if (props) {
      if (props.checkIsAllowed) {
        const {subscribeMethods} = this.settings;
        let notFoundRes = ResponseBuilder.notEnabledResponse(subscribeMethods, 'json');
        if (notFoundRes) {
          return notFoundRes;
        }
      }
      if (props.isValid) {
        if (!props.isValid(this.jsonData)) {
          return ResponseBuilder.Response404();
        }
      }
    }
    const newResponse = new Response(JSON.stringify(this.jsonData), res);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  }
}

export class SitemapResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'text/xml';
  }

  _getResponse(props) {
    const res = super._getResponse(props);
    let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">'
    xml += `<url><loc>${this.jsonData.home_page_url}</loc><image:image><image:loc>${this.jsonData.icon}</image:loc></image:image></url>`;
    this.jsonData.items.map((item) => {
      xml += `<url><loc>${item._microfeed.web_url}</loc><lastmod>${item.date_published}</lastmod>`
      if (item.attachments) {
        item.attachments.forEach((attachment) => {
          if (attachment.mime_type.startsWith('image/')) {
            xml += `<image:image><image:loc>${attachment.url}</image:loc></image:image>`
          } else if (attachment.mime_type.startsWith('video/')) {
            xml += `<video:video><video:title>${escapeHtml(item.title)}</video:title><video:publication_date>${item.date_published}</video:publication_date><video:content_loc>${attachment.url}</video:content_loc></video:video>`
          }
        })
      }
      xml += `</url>`
    })
    xml += '</urlset>';
    return new Response(xml, res);
  }

  get _fetchItems() {
    const queryKwargs  = this.fetchItemsObj.queryKwargs || {};
    return getFetchItemsParams(
      this.request,
      {
        // status: STATUSES.PUBLISHED,
        ...queryKwargs,
      }, -1);
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
          const faviconUrl = urlJoinWithRelative(publicBucketUrl, favicon.url);
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
    const component = props.getComponent(this.content, this.jsonData, theme);
    if (!component) {
      return ResponseBuilder.Response404();
    }
    const fromReact = renderReactToHtml(component);
    const newRes = new Response(fromReact, res);
    return new HTMLRewriter()
      .on('head', new CodeInjector(this.settings, theme, sharedTheme))
      .on('body', new CodeInjector(this.settings, theme, sharedTheme))
      .transform(newRes);
  }
}
