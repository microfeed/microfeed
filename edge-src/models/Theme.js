import {decorateForItem} from "./Feed";

const Mustache = require('mustache');


export default class Theme {
  constructor(jsonData, settings=null) {
    this.jsonData = jsonData;
    this.settings = settings;

    this.theme = 'default';
    if (settings && settings.styles && settings.styles.currentTheme) {
      this.theme = settings.styles.currentTheme;
    }
  }

  name() {
    return this.theme;
  }

  getWebHeader() {
    const tmpl = this.getWebHeaderTmpl();
    const html = Mustache.render(tmpl, {...this.jsonData,});
    return {html};
  }

  getWebHeaderTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/web_header.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webHeader;
    }
    return tmpl;
  }

  getWebFooter() {
    const tmpl = this.getWebFooterTmpl();
    const html = Mustache.render(tmpl, {...this.jsonData,});
    return {html};
  }

  getWebFooterTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/web_footer.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webFooter;
    }
    return tmpl;
  }

  getRssStylesheetTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
      // TODO: configure esbuild to load xsl?
      tmpl = require('../common/default_themes/rss_stylesheet.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].rssStylesheet;
    }
    return tmpl;
  }

  getRssStylesheet() {
    const tmpl = this.getRssStylesheetTmpl();
    const stylesheet = Mustache.render(tmpl, {});
    return {
      stylesheet,
    };
  }

  getFeedWeb() {
    const tmpl = this.getFeedWebTmpl();
    this.jsonData.items.forEach(item => decorateForItem(item));
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
    });
    return {
      html,
    };
  }

  getFeedWebTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/feed_web.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].feedWeb;
    }
    return tmpl;
  }

  getItemWeb(item) {
    decorateForItem(item);
    const tmpl = this.getItemWebTmpl();
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
      item,
    });
    return {
      html,
    };
  }

  getItemWebTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/item_web.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].itemWeb;
    }
    return tmpl;
  }
}
