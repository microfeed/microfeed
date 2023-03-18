import {CODE_TYPES, SETTINGS_CATEGORIES} from "../../common-src/Constants";
import {CODE_FILES} from "../../common-src/Constants";
import DEFAULT_WEB_HEADER from '../common/default_themes/web_header.html';
import DEFAULT_WEB_BODY_END from '../common/default_themes/web_body_end.html';
import DEFAULT_WEB_BODY_START from '../common/default_themes/web_body_start.html';
import DEFAULT_RSS_STYLESHEET from '../common/default_themes/rss_stylesheet.html';
import DEFAULT_WEB_FEED from '../common/default_themes/web_feed.html';
import DEFAULT_WEB_ITEM from '../common/default_themes/web_item.html';

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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_HEADER]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_HEADER] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_HEADER] : DEFAULT_WEB_HEADER;
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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_END]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_END] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_BODY_END] : DEFAULT_WEB_BODY_END;
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
      tmpl = (this.settings && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE] && this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_START]) ?
        this.settings[SETTINGS_CATEGORIES.CUSTOM_CODE][CODE_FILES.WEB_BODY_START] : '';
    } else {
      tmpl = this.themeBundle ? this.themeBundle[CODE_FILES.WEB_BODY_START] : DEFAULT_WEB_BODY_START;
    }
    return tmpl;
  }

  getRssStylesheetTmpl() {
    // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
    // TODO: configure esbuild to load xsl?
    return this.themeBundle ? this.themeBundle[CODE_FILES.RSS_STYLESHEET] : DEFAULT_RSS_STYLESHEET;
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
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_FEED] : DEFAULT_WEB_FEED;
  }

  getWebItem(item) {
    const tmpl = this.getWebItemTmpl();
    const html = Mustache.render(tmpl, {
      ...this.jsonData,

      // TODO: Remove "item". We don't need this "item" field any more. Use "items.0" instead.
      item,
    });
    return {
      html,
    };
  }

  getWebItemTmpl() {
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_ITEM] : DEFAULT_WEB_ITEM;
  }
}
