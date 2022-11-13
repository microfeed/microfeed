import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";
import tmpl from "../common/default_themes/web_footer.html";

const Mustache = require('mustache');

function episodeUrl() {
  return PUBLIC_URLS.pageEpisode(this.id, this.title);
}

function pubDate(episode=null) {
  let eps = episode;
  if (!episode) {
    eps = this;
  }
  return humanizeMs(eps.pubDateMs);
}

function descriptionText() {
  return convert(this.description, {});
}

export default class Theme {
  constructor(jsonData, settings=null) {
    this.jsonData = jsonData;
    this.settings = settings;

    this.theme = 'default';
    if (settings && settings.styles && settings.styles.currentTheme) {
      this.theme = settings.styles.currentTheme;
    }
    // const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    // this.KEY = `${projectPrefix(env)}/database/${LISTEN_HOST_VERSION}-feed.json`;
    // this.LH_DB = LH_DATABASE;
    // this.LISTEN_HOST_VERSION = LISTEN_HOST_VERSION;
    // this.content = null;
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
    const {podcast, episodes, subscribeMethods} = this.jsonData;
    const tmpl = this.getFeedWebTmpl();
    const html = Mustache.render(tmpl, {
      podcast,
      episodes,
      subscribeMethods,

      episodeUrl,
      pubDate,
      descriptionText,
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

  getEpisodeWeb(episode) {
    const {podcast, subscribeMethods} = this.jsonData;
    episode.pubDate = pubDate(episode);
    const tmpl = this.getEpisodeWebTmpl();
    const html = Mustache.render(tmpl, {
      episode,
      podcast,
      subscribeMethods,
    });
    return {
      html,
    };
  }

  getEpisodeWebTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/episode_web.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].episodeWeb;
    }
    return tmpl;
  }
}
