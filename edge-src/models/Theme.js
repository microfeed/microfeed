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

  getWebFeed() {
    const tmpl = this.getWebFeedTmpl();
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
    });
    return {
      html,
    };
  }

  getWebFeedTmpl() {
    let tmpl;
    if (this.theme === 'default' || !this.settings.styles.themes[this.theme].webFeed) {
      tmpl = require('../common/default_themes/web_feed.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webFeed;
    }
    return tmpl;
  }

  getWebItem(item) {
    const tmpl = this.getWebItemTmpl();
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
      item,
    });
    return {
      html,
    };
  }

  getWebItemTmpl() {
    let tmpl = null;
    if (this.theme === 'default' || !this.settings.styles.themes[this.theme].webItem) {
      tmpl = require('../common/default_themes/web_item.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webItem;
    }
    return tmpl;
  }
}
