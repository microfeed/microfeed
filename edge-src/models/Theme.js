import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";
import {ENCLOSURE_CATEGORIES} from "../../common-src/Constants";

const Mustache = require('mustache');

function decorateMediaFileForItem(item) {
   item.webUrl = PUBLIC_URLS.itemWeb(item.id, item.title);
   item.pubDate = humanizeMs(item.pubDateMs);
   item.descriptionText = convert(item.description, {});

  if (item.mediaFile && item.mediaFile.category) {
    item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
    item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
    item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
    item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
    item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;
  }
}

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
    const html = Mustache.render(tmpl, {});
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
    const html = Mustache.render(tmpl, {});
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
    this.jsonData.items.forEach(item => decorateMediaFileForItem(item));
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
    decorateMediaFileForItem(item);
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
