import {SETTINGS_CATEGORIES} from "../../common-src/Constants";

const Mustache = require('mustache');

export default class Theme {
  constructor(jsonData, settings=null, themeName = null) {
    this.jsonData = jsonData;
    this.settings = settings;

    this.theme = 'custom';
    if (!themeName) {
      // Select current theme
      if (settings && settings[SETTINGS_CATEGORIES.CUSTOM_CODE] &&
        settings[SETTINGS_CATEGORIES.CUSTOM_CODE].currentTheme &&
        settings[SETTINGS_CATEGORIES.CUSTOM_CODE].themes[settings[SETTINGS_CATEGORIES.CUSTOM_CODE].currentTheme]) {
        this.theme = settings[SETTINGS_CATEGORIES.CUSTOM_CODE].currentTheme;
      }
    } else {
      this.theme = themeName;
    }
    this.themeBundle = (this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] &&
      this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE].themes) ?
      this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE].themes[this.theme] : null;
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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE].webHeader : '';
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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE].webBodyEnd : '';
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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE].webBodyStart : '';
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
