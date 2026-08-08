import {CODE_TYPES, SETTINGS_CATEGORIES} from "@/shared/Constants";
import {CODE_FILES} from "@/shared/Constants";
import DEFAULT_WEB_HEADER from "./defaults/web_header.html?raw";
import DEFAULT_WEB_BODY_END from "./defaults/web_body_end.html?raw";
import DEFAULT_WEB_BODY_START from "./defaults/web_body_start.html?raw";
import DEFAULT_RSS_STYLESHEET from "./defaults/rss_stylesheet.html?raw";
import DEFAULT_WEB_FEED from "./defaults/web_feed.html?raw";
import DEFAULT_WEB_ITEM from "./defaults/web_item.html?raw";
import Mustache from "mustache";
import {getBuiltInTemplateVariables} from "@/shared/TemplateVariables";

export default class Theme {
  [member: string]: any;

  constructor(jsonData: any, settings: any = null, themeName: string | null = null) {
    this.jsonData = jsonData;
    this.settings = settings;
    this.templateVariables = getBuiltInTemplateVariables();

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

  renderContext(extra: Record<string, unknown> = {}) {
    return {
      ...this.jsonData,
      ...this.templateVariables,
      ...extra,
    };
  }

  getWebHeader() {
    const tmpl = this.getWebHeaderTmpl();
    const html = Mustache.render(tmpl, this.renderContext());
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
    const html = Mustache.render(tmpl, this.renderContext());
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
    const html = Mustache.render(tmpl, this.renderContext());
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
    const stylesheet = Mustache.render(tmpl, this.renderContext());
    return {
      stylesheet,
    };
  }

  getWebFeed() {
    const tmpl = this.getWebFeedTmpl();
    const html = Mustache.render(tmpl, this.renderContext());
    return {
      html,
    };
  }

  getWebFeedTmpl() {
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_FEED] : DEFAULT_WEB_FEED;
  }

  getWebItem(item: any) {
    const tmpl = this.getWebItemTmpl();
    const html = Mustache.render(tmpl, this.renderContext({
      // TODO: Remove "item". We don't need this "item" field any more. Use "items.0" instead.
      item,
    }));
    return {
      html,
    };
  }

  getWebItemTmpl() {
    return this.themeBundle ? this.themeBundle[CODE_FILES.WEB_ITEM] : DEFAULT_WEB_ITEM;
  }
}
