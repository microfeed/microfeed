import {CODE_TYPES, SETTINGS_CATEGORIES} from "../../common-src/Constants";
import {CODE_FILES} from "../../common-src/Constants";

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
    if (this.theme === CODE_TYPES.SHARED) {
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_HEADER] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_HEADER] : require('../common/default_themes/web_header.html');
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
    if (this.theme === CODE_TYPES.SHARED) {
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_END] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_BODY_END] : require('../common/default_themes/web_body_end.html');
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
    if (this.theme === CODE_TYPES.SHARED) {
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_START] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_BODY_START] : require('../common/default_themes/web_body_start.html');
    }
    return tmpl;
  }

  getRssStylesheetTmpl() {
    // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
    // TODO: configure esbuild to load xsl?
    return this.themeBundle ? this.themeBundle[CODE_FILES.RSS_STYLESHEET] : require('../common/default_themes/rss_stylesheet.html');
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
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_FEED] : require('../common/default_themes/web_feed.html');
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
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_ITEM] : require('../common/default_themes/web_item.html');
  }
}
