const Mustache = require('mustache');

export default class Theme {
  constructor(jsonData, settings=null, themeName = null) {
    this.jsonData = jsonData;
    this.settings = settings;

    this.theme = 'custom';
    if (!themeName) {
      // Select current theme
      if (settings && settings.styles && settings.styles.currentTheme &&
        settings.styles.themes[settings.styles.currentTheme]) {
        this.theme = settings.styles.currentTheme;
      }
    } else {
      this.theme = themeName;
    }
    this.themeBundle = (this.settings.styles && this.settings.styles.themes) ?
      this.settings.styles.themes[this.theme] : null;
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
    let tmpl;
    if (this.theme === 'global') {
      tmpl = (this.settings && this.settings.styles) ? this.settings.styles.webHeader : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle.webHeader : require('../common/default_themes/web_header.html');
    }
    return tmpl;
  }

  getWebBodyEnd() {
    const tmpl = this.getWebBodyEndTmpl();
    const html = Mustache.render(tmpl, {...this.jsonData,});
    return {html};
  }

  getWebBodyEndTmpl() {
    let tmpl = null;
    if (this.theme === 'global') {
      tmpl = (this.settings && this.settings.styles) ? this.settings.styles.webBodyEnd : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle.webBodyEnd : require('../common/default_themes/web_body_end.html');
    }
    return tmpl;
  }

  getWebBodyStart() {
    const tmpl = this.getWebBodyStartTmpl();
    const html = Mustache.render(tmpl, {...this.jsonData,});
    return {html};
  }

  getWebBodyStartTmpl() {
    let tmpl;
    if (this.theme === 'global') {
      tmpl = (this.settings && this.settings.styles) ? this.settings.styles.webBodyStart : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle.webBodyStart : require('../common/default_themes/web_body_start.html');
    }
    return tmpl;
  }

  getRssStylesheetTmpl() {
    // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
    // TODO: configure esbuild to load xsl?
    return this.themeBundle ? this.themeBundle.rssStylesheet : require('../common/default_themes/rss_stylesheet.html');
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
    return this.themeBundle ? this.themeBundle.webFeed : require('../common/default_themes/web_feed.html');
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
    return this.themeBundle ? this.themeBundle.webItem : require('../common/default_themes/web_item.html');
  }
}
